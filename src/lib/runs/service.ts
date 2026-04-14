import { SupabaseClient } from '@supabase/supabase-js';
import { tasks, runs } from '@trigger.dev/sdk/v3';
import { runAgentWorkflow } from '@/trigger/runAgentWorkflow';

export interface StartRunResult {
  success: boolean;
  run_id?: string;
  run_number?: number;
  message?: string;
  error?: string;
}

/**
 * Unified service to start an agent run.
 * Handles concurrency, force-cancellation, run record creation, and workflow triggering.
 */
export async function startAgentRun(
  supabase: SupabaseClient,
  agentId: string,
  userId: string,
  force: boolean = false
): Promise<StartRunResult> {
  try {
    // 1. Verify agent and check current state
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id, status')
      .eq('id', agentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (agentErr || !agent) {
      return { success: false, error: 'Agent not found or access denied' };
    }

    // 2. Handle Force Cancel
    if (force) {
      const { data: activeRuns } = await supabase
        .from('agent_runs')
        .select('id, trigger_task_id')
        .eq('agent_id', agentId)
        .in('status', ['pending', 'running', 'waiting_for_human']);

      if (activeRuns && activeRuns.length > 0) {
        for (const run of activeRuns) {
          // Cancel on Trigger.dev if we have a task ID
          if (run.trigger_task_id) {
            try {
              await runs.cancel(run.trigger_task_id);
            } catch (err) {
              console.error(`[startAgentRun] Failed to cancel Trigger task ${run.trigger_task_id}:`, err);
            }
          }

          // Mark DB as cancelled
          await supabase
            .from('agent_runs')
            .update({ status: 'cancelled' })
            .eq('id', run.id);

          // Post cancellation card to chat
          await supabase.from('agent_conversations').insert({
            agent_id: agentId,
            user_id: userId,
            run_id: run.id,
            role: 'agent',
            message_type: 'run_card',
            content: 'Run cancelled by user',
            metadata: { status: 'cancelled', run_number: 0, cancelled_by_user: true }
          });
        }
      }
    } else {
      // Concurrency Check (Non-force)
      const { data: existingRun } = await supabase
        .from('agent_runs')
        .select('id')
        .eq('agent_id', agentId)
        .in('status', ['pending', 'running', 'waiting_for_human'])
        .maybeSingle();

      if (existingRun) {
        return { 
          success: true, 
          message: 'Agent is already running', 
          run_id: existingRun.id 
        };
      }
    }

    // 3. Calculate accurate run number
    const { count } = await supabase
      .from('agent_runs')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId);
    const nextRunNumber = (count || 0) + 1;

    // 4. Create run record
    const { data: newRun, error: runErr } = await supabase
      .from('agent_runs')
      .insert({
        agent_id: agentId,
        user_id: userId,
        status: 'pending', // Use 'pending' initially, worker will claim it as 'running'
        run_number: nextRunNumber,
        global_state: { current_step: 1, step_statuses: {} },
      })
      .select('id, run_number')
      .single();

    if (runErr || !newRun) {
      // This might fail if the partial unique index blocks it (race condition)
      if (runErr?.code === '23505') {
        return { success: false, error: 'A run is already in progress for this agent.' };
      }
      return { success: false, error: `Failed to create run record: ${runErr?.message}` };
    }

    // 5. Trigger workflow via Trigger.dev
    try {
      const trigger = await tasks.trigger<typeof runAgentWorkflow>('run-agent-workflow', {
        run_id: newRun.id,
      });

      // Update agent status AND store the task ID
      await supabase
        .from('agents')
        .update({ status: 'running' })
        .eq('id', agentId);

      await supabase
        .from('agent_runs')
        .update({ trigger_task_id: trigger.id })
        .eq('id', newRun.id);

      return {
        success: true,
        run_id: newRun.id,
        run_number: newRun.run_number
      };
    } catch (triggerErr: any) {
      console.error(`[startAgentRun] Trigger.dev failure: ${triggerErr.message}`);
      // Cleanup the failed run record
      await supabase.from('agent_runs').delete().eq('id', newRun.id);
      return { success: false, error: `Background worker failed to start: ${triggerErr.message}` };
    }
  } catch (err: any) {
    console.error(`[startAgentRun] Unexpected error:`, err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
}
