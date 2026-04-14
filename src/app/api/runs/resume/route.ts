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
      console.error(`[runs/resume] Auth error: ${authError?.message || 'No user'}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { run_id, human_feedback } = body;

    if (!run_id) {
      return NextResponse.json({ error: 'run_id is required' }, { status: 400 });
    }

    // Verify run belongs to user
    const { data: run, error: runErr } = await serviceClient
      .from('agent_runs')
      .select('id, status, global_state')
      .eq('id', run_id)
      .eq('user_id', user.id)
      .single();

    if (runErr || !run) {
      return NextResponse.json({ error: 'Run not found or access denied' }, { status: 404 });
    }

    if (run.status !== 'waiting_for_human') {
      return NextResponse.json({ error: 'Run is not awaiting human review' }, { status: 400 });
    }

    // Inject human feedback into the global_state notepad, and mark current step as completed.
    const state = run.global_state || {};
    const stepStatuses = state.step_statuses || {};
    const currentStep = state.current_step;
    
    if (currentStep) {
      stepStatuses[currentStep.toString()] = "completed";
      if (human_feedback) {
        state[`step_${currentStep}_human_feedback`] = human_feedback;
      }
      
      // Increment step internally for the engine boundary so it knows to skip.
      state.current_step = currentStep + 1;
    }

    // Unpause in DB
    await serviceClient
      .from('agent_runs')
      .update({
        status: 'pending', // Task marks it running immediately
        global_state: { ...state, step_statuses: stepStatuses }
      })
      .eq('id', run_id);

    // Awaken Trigger pipeline identically
    const trigger = await tasks.trigger<typeof runAgentWorkflow>('run-agent-workflow', {
      run_id: run.id,
    });

    await serviceClient
      .from('agent_runs')
      .update({ trigger_task_id: trigger.id })
      .eq('id', run_id);

    return NextResponse.json({ success: true, run_id: run.id });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[runs/resume] Catch block: ${message}`);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
