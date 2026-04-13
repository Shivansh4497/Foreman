import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
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
      console.error(`[agents/profile] Auth error: ${authError?.message || 'No user returned'}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch agent and verify ownership
    const { data: agent, error: agentError } = await serviceClient
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (agentError) {
      console.error(`[agents/profile] Agent fetch error: ${agentError.message}`);
      return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found or access denied' }, { status: 404 });
    }

    // 2. Fetch agent steps
    const { data: steps, error: stepsError } = await serviceClient
      .from('agent_steps')
      .select('*')
      .eq('agent_id', agentId)
      .order('step_number', { ascending: true });

    if (stepsError) {
      console.error(`[agents/profile] Steps fetch error: ${stepsError.message}`);
      return NextResponse.json({ error: 'Failed to fetch steps' }, { status: 500 });
    }

    // 3. Fetch agent runs (limit 20)
    const { data: runs, error: runsError } = await serviceClient
      .from('agent_runs')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (runsError) {
      console.error(`[agents/profile] Runs fetch error: ${runsError.message}`);
      return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 });
    }

    // 4. Calculate stats
    // total_runs: Count of ALL runs for this agent
    const { count: totalRunsCount, error: countError } = await serviceClient
      .from('agent_runs')
      .select('*', { count: 'exact', head: true })
      .eq('agent_id', agentId);

    if (countError) {
      console.error(`[agents/profile] Count error: ${countError.message}`);
    }

    // avg_run_time: Average duration of COMPLETED runs
    // Note: completed_at - created_at. We'll fetch the durations for calculation.
    const { data: completedRuns, error: avgError } = await serviceClient
      .from('agent_runs')
      .select('created_at, completed_at')
      .eq('agent_id', agentId)
      .eq('status', 'completed')
      .not('completed_at', 'is', null);

    let avgRunTime = 0;
    if (!avgError && completedRuns && completedRuns.length > 0) {
      const totalDurationSec = completedRuns.reduce((acc, run) => {
        const start = new Date(run.created_at).getTime();
        const end = new Date(run.completed_at!).getTime();
        return acc + (end - start) / 1000;
      }, 0);
      avgRunTime = totalDurationSec / completedRuns.length;
    }

    return NextResponse.json({
      agent: {
        ...agent,
        total_runs: totalRunsCount || 0,
        avg_run_time: Math.round(avgRunTime), // in seconds
      },
      steps: steps || [],
      runs: runs || [],
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[agents/profile] Catch block: ${message}`);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
