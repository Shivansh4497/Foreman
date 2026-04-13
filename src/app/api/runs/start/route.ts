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
    const { agent_id } = body;

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

    // Update agent status to running
    await serviceClient
      .from('agents')
      .update({ status: 'running' })
      .eq('id', agent_id);

    // Trigger background executed via Trigger.dev
    await tasks.trigger<typeof runAgentWorkflow>('run-agent-workflow', {
      run_id: newRun.id,
    });

    return NextResponse.json({ success: true, run_id: newRun.id });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[runs/start] Catch block: ${message}`);
    return NextResponse.json({ error: `An unexpected error occurred: ${message}` }, { status: 500 });
  }
}
