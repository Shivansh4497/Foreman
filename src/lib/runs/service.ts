import { SupabaseClient } from '@supabase/supabase-js';
import { tasks, runs } from '@trigger.dev/sdk/v3';
import { runAgentWorkflow } from '@/trigger/runAgentWorkflow';

export interface StartRunResult {
  success: boolean;
  run_id?: string;
  run_number?: number;
  message?: string;
  error?: string;
  /** Stable machine-readable code for callers to map to HTTP status without string matching. */
  code?: 'ACTIVE_RUN_EXISTS' | 'AGENT_NOT_FOUND' | 'TRIGGER_FAILED' | 'UNKNOWN_ERROR';
}

/**
 * Unified service to start an agent run.
 * Handles concurrency, force-cancellation, run record creation, and workflow triggering.
 *
 * Concurrency guarantees:
 * - The DB partial unique index (idx_one_active_run_per_agent) is the final arbiter.
 *   If two concurrent requests both pass the application-level check, only one INSERT
 *   will succeed; the other receives a 23505 unique-violation and returns a clean error.
 * - Force-cancel only updates rows that are still in an active state (pending/running/
 *   waiting_for_human), preventing accidental updates to completed/failed rows.
 */
export async function startAgentRun(
  supabase: SupabaseClient,
  agentId: string,
  userId: string,
  force: boolean = false
): Promise<StartRunResult> {
  const ACTIVE_STATUSES = ['pending', 'running', 'waiting_for_human'] as const;

  try {
    // 1. Verify agent exists and belongs to user
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id, status')
      .eq('id', agentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (agentErr || !agent) {
      console.error(`[startAgentRun] Agent not found: agentId=${agentId} userId=${userId}`);
      return { success: false, error: 'Agent not found or access denied' };
    }

    // 2. Handle Force Cancel — cancel all currently active runs for this agent
    if (force) {
      const { data: activeRuns } = await supabase
        .from('agent_runs')
        .select('id, trigger_task_id')
        .eq('agent_id', agentId)
        .in('status', ACTIVE_STATUSES);

      if (activeRuns && activeRuns.length > 0) {
        for (const run of activeRuns) {
          // Attempt Trigger.dev cancellation if we have a task ID
          if (run.trigger_task_id) {
            try {
              await runs.cancel(run.trigger_task_id);
              console.log(`[startAgentRun] Cancelled Trigger task ${run.trigger_task_id} for run ${run.id}`);
            } catch (err) {
              // Non-fatal: task may have already finished; continue to mark DB cancelled
              console.error(`[startAgentRun] Failed to cancel Trigger task ${run.trigger_task_id} (may already be done):`, err);
            }
          } else {
            console.warn(`[startAgentRun] Run ${run.id} has no trigger_task_id; skipping remote cancel`);
          }

          // Conditionally mark DB as cancelled — only if still in an active state
          // (guards against race where the run completed between the SELECT and this UPDATE)
          const { error: cancelErr } = await supabase
            .from('agent_runs')
            .update({ status: 'cancelled' })
            .eq('id', run.id)
            .in('status', ACTIVE_STATUSES);  // ← atomic guard

          if (cancelErr) {
            console.error(`[startAgentRun] Failed to mark run ${run.id} as cancelled:`, cancelErr.message);
          } else {
            console.log(`[startAgentRun] Marked run ${run.id} as cancelled`);
          }

          // 3. Get actual run number for this run
          const { data: cancelledRunData } = await supabase
            .from('agent_runs')
            .select('id')
            .eq('agent_id', agentId)
            .order('created_at', { ascending: true });
          const cancelledRunIndex = cancelledRunData
            ? cancelledRunData.findIndex(r => r.id === run.id) + 1
            : 0;

          // 4. Post cancellation card to chat
          await supabase.from('agent_conversations').insert({
            agent_id: agentId,
            user_id: userId,
            run_id: run.id,
            role: 'agent',
            message_type: 'run_card',
            content: 'Run cancelled by user',
            metadata: {
              status: 'cancelled',
              run_number: cancelledRunIndex,
              cancelled_by_user: true,
              step_count: 0,
              duration_seconds: 0,
              output_preview: '',
              steps: []
            }
          });
        }
      }
    } else {
      // Non-force: concurrency check — return early if a run is already active
      const { data: existingRun } = await supabase
        .from('agent_runs')
        .select('id')
        .eq('agent_id', agentId)
        .in('status', ACTIVE_STATUSES)
        .maybeSingle();

      if (existingRun) {
        console.log(`[startAgentRun] Agent ${agentId} already has active run ${existingRun.id}`);
        return {
          success: false,                     // treat as blocking conflict at API layer
          code: 'ACTIVE_RUN_EXISTS',
          message: 'Agent is already running',
          run_id: existingRun.id
        };
      }
    }

    // 3. Create run record.
    //    run_number is intentionally omitted from the INSERT payload — the DB BEFORE INSERT
    //    trigger (trg_set_run_number) computes the correct value atomically, removing any
    //    off-by-one risk from application-level COUNT queries.
    const { data: newRun, error: runErr } = await supabase
      .from('agent_runs')
      .insert({
        agent_id: agentId,
        user_id: userId,
        status: 'pending', // Worker will atomically claim it as 'running' via eq('status','pending')
        global_state: { current_step: 1, step_statuses: {} },
      })
      .select('id, run_number')
      .single();

    if (runErr || !newRun) {
      if (runErr?.code === '23505') {
        // Partial unique index blocked a duplicate active run — expected under concurrent requests
        console.warn(`[startAgentRun] Unique index blocked duplicate active run for agent ${agentId}`);
        return { success: false, code: 'ACTIVE_RUN_EXISTS', error: 'A run is already in progress for this agent.' };
      }
      console.error(`[startAgentRun] Failed to insert run record:`, runErr?.message);
      return { success: false, error: `Failed to create run record: ${runErr?.message}` };
    }

    console.log(`[startAgentRun] Created run ${newRun.id} (#${newRun.run_number}) for agent ${agentId}`);

    // 4. Trigger workflow via Trigger.dev
    try {
      const trigger = await tasks.trigger<typeof runAgentWorkflow>('run-agent-workflow', {
        run_id: newRun.id,
      });

      console.log(`[startAgentRun] Triggered Trigger.dev task ${trigger.id} for run ${newRun.id}`);

      // Persist trigger task ID and update agent status in parallel
      await Promise.all([
        supabase
          .from('agent_runs')
          .update({ trigger_task_id: trigger.id })
          .eq('id', newRun.id),
        supabase
          .from('agents')
          .update({ status: 'running' })
          .eq('id', agentId),
      ]);

      return {
        success: true,
        run_id: newRun.id,
        run_number: newRun.run_number,  // DB-authoritative value
      };
    } catch (triggerErr: any) {
      console.error(`[startAgentRun] Trigger.dev failure: ${triggerErr.message}`);
      // Clean up the orphaned pending run so the partial unique index stays clear
      await supabase.from('agent_runs').delete().eq('id', newRun.id);
      return { success: false, error: `Background worker failed to start: ${triggerErr.message}` };
    }
  } catch (err: any) {
    console.error(`[startAgentRun] Unexpected error:`, err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
}
