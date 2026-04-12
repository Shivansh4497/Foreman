import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
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
      console.error(`[settings/usage] Auth error: ${authError?.message || 'No user'}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: agents, error: agentsError } = await serviceClient
      .from('agents')
      .select('id, name, status, total_runs, human_hours_per_run, created_at')
      .eq('user_id', user.id)
      .neq('status', 'draft')
      .order('created_at', { ascending: false });

    if (agentsError) {
      console.error(`[settings/usage] Agents query error: ${agentsError.message}`);
      return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 });
    }

    const agentList = agents ?? [];

    const total_agents = agentList.length;
    const active_agents = agentList.filter(a => a.status === 'active').length;
    const total_runs = agentList.reduce((sum, a) => sum + (a.total_runs ?? 0), 0);
    const total_hours_saved = agentList.reduce((sum, a) => {
      return sum + ((a.human_hours_per_run ?? 0) * (a.total_runs ?? 0));
    }, 0);

    return NextResponse.json({
      total_agents,
      active_agents,
      total_runs,
      total_hours_saved: Math.round(total_hours_saved * 10) / 10,
      agents: agentList.map(a => ({
        name: a.name ?? 'Unnamed agent',
        status: a.status,
        total_runs: a.total_runs ?? 0,
        hours_saved: Math.round((a.human_hours_per_run ?? 0) * (a.total_runs ?? 0) * 10) / 10,
      })),
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[settings/usage] Catch: ${message}`);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
