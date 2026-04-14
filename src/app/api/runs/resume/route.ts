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
      console.warn(`[runs/resume] Run ${run_id} is in status '${run.status}', not 'waiting_for_human'. Possible duplicate resume.`);
      return NextResponse.json({ error: 'Run is not awaiting human review' }, { status: 400 });
    }

    // Inject human feedback into global_state and advance step counter
    const state = run.global_state || {};
    const stepStatuses = state.step_statuses || {};
    const currentStep = state.current_step;

    if (currentStep) {
      stepStatuses[currentStep.toString()] = 'completed';
      if (human_feedback) {
        state[`step_${currentStep}_human_feedback`] = human_feedback;
      }
      // Advance step pointer so the worker skips the already-reviewed step
      state.current_step = currentStep + 1;
    }

    // Atomic transition: waiting_for_human → pending
    // Only succeeds if status is still 'waiting_for_human'; concurrent resume clicks
    // will see 0 rows updated and should be treated as duplicates.
    const { data: updatedRun, error: updateErr } = await serviceClient
      .from('agent_runs')
      .update({
        status: 'pending', // Worker will atomically claim it as 'running' via eq('status','pending')
        global_state: { ...state, step_statuses: stepStatuses }
      })
      .eq('id', run_id)
      .eq('status', 'waiting_for_human')  // ← atomic guard against double-resume
      .select('id')
      .single();

    if (updateErr || !updatedRun) {
      // Another request already transitioned this run; return 409 to signal duplicate
      console.warn(`[runs/resume] Run ${run_id} could not be transitioned (already resumed or concurrent request). updateErr: ${updateErr?.message}`);
      return NextResponse.json({ error: 'Run has already been resumed or is no longer waiting' }, { status: 409 });
    }

    console.log(`[runs/resume] Run ${run_id} transitioned to pending. Triggering worker.`);

    // Trigger worker and persist task ID
    const trigger = await tasks.trigger<typeof runAgentWorkflow>('run-agent-workflow', {
      run_id: run.id,
    });

    await serviceClient
      .from('agent_runs')
      .update({ trigger_task_id: trigger.id })
      .eq('id', run_id);

    console.log(`[runs/resume] Trigger.dev task ${trigger.id} issued for run ${run_id}`);

    return NextResponse.json({ success: true, run_id: run.id });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[runs/resume] Catch block: ${message}`);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
