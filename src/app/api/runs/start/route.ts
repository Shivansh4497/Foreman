import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tasks } from '@trigger.dev/sdk/v3';
import { runAgentWorkflow } from '@/trigger/runAgentWorkflow';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      console.error(`[runs/start] Auth error: ${authError?.message || 'No user'}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { agent_id, force } = body;

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    // Verify agent belongs to user
    const { data: agent, error: agentErr } = await serviceClient
      .from('agents')
      .select('id, status')
      .eq('id', agent_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (agentErr || !agent) {
      return NextResponse.json({ error: 'Agent not found or access denied' }, { status: 404 });
    }

    // NEW: Handle Force Cancel
    if (force) {
      const { data: activeRuns } = await serviceClient
        .from('agent_runs')
        .select('id, trigger_task_id')
        .eq('agent_id', agent_id)
        .in('status', ['running', 'waiting_for_human']);

      if (activeRuns && activeRuns.length > 0) {
        for (const run of activeRuns) {
          // 1. Cancel on Trigger.dev if we have a task ID
          if (run.trigger_task_id) {
            try {
              await tasks.cancel(run.trigger_task_id);
              console.log(`[runs/start] Cancelled Trigger.dev task: ${run.trigger_task_id}`);
            } catch (err) {
              console.error(`[runs/start] Failed to cancel Trigger.dev task: ${err}`);
            }
          }

          // 2. Mark DB as cancelled
          await serviceClient
            .from('agent_runs')
            .update({ status: 'cancelled' })
            .eq('id', run.id);

          // 3. Post cancellation card to chat
          await serviceClient.from('agent_conversations').insert({
            agent_id: agent_id,
            user_id: user.id,
            run_id: run.id,
            role: 'agent',
            message_type: 'run_card',
            content: 'Run cancelled by user',
            metadata: { status: 'cancelled', run_number: 0 }
          });
        }
      }
    } else if (agent.status === 'running') {
      // Concurrency Check (Non-force)
      const { data: existingRun } = await serviceClient
        .from('agent_runs')
        .select('id, created_at')
        .eq('agent_id', agent_id)
        .in('status', ['running', 'waiting_for_human'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingRun) {
        return NextResponse.json({ 
          success: true, 
          message: 'Agent is already running', 
          run_id: existingRun.id 
        });
      }
    }

    // Create run record
    const { data: newRun, error: runErr } = await serviceClient
      .from('agent_runs')
      .insert({
        agent_id: agent.id,
        user_id: user.id,
        status: 'running',
        global_state: { current_step: 1, step_statuses: {} },
      })
      .select('id')
      .single();

    if (runErr || !newRun) {
      console.error(`[runs/start] Failed to create run: ${runErr?.message}`);
      return NextResponse.json({ error: `Failed to initialize agent run: ${runErr?.message}` }, { status: 500 });
    }

    // Trigger background executed via Trigger.dev
    try {
      const trigger = await tasks.trigger<typeof runAgentWorkflow>('run-agent-workflow', {
        run_id: newRun.id,
      });

      // Update agent status AND store the task ID
      await serviceClient
        .from('agents')
        .update({ status: 'running' })
        .eq('id', agent_id);

      await serviceClient
        .from('agent_runs')
        .update({ trigger_task_id: trigger.id })
        .eq('id', newRun.id);

    } catch (triggerErr: any) {
      console.error(`[runs/start] Trigger.dev failure: ${triggerErr.message}`);
      await serviceClient.from('agent_runs').delete().eq('id', newRun.id);
      return NextResponse.json({ 
        error: `Background worker failed to start. Details: ${triggerErr.message}` 
      }, { status: 503 });
    }

    // Fetch run number for response
    const { count } = await serviceClient
      .from('agent_runs')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agent_id);

    return NextResponse.json({ 
      success: true, 
      run_id: newRun.id,
      run_number: (count || 0) + 1 
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[runs/start] Catch block: ${message}`);
    return NextResponse.json({ error: `An unexpected error occurred: ${message}` }, { status: 500 });
  }
}
