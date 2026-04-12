import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agent_id = searchParams.get('agent_id');

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id query parameter is required' }, { status: 400 });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      console.error('[scout/blueprint] Missing authorization header');
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      console.error(`[scout/blueprint] Auth error: ${authError?.message || 'No user returned'}`);
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 401 });
    }

    // 1. Verify ownership and fetch agent metadata.
    const { data: agent, error: agentError } = await serviceClient
      .from('agents')
      .select('id, name, schedule, category, blueprint_json')
      .eq('id', agent_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (agentError) {
      console.error(`[scout/blueprint] Agent fetch error: ${agentError.message}`);
      return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found or access denied' }, { status: 404 });
    }

    // 2. Fetch agent steps ordered by step_number ascending.
    const { data: steps, error: stepsError } = await serviceClient
      .from('agent_steps')
      .select(
        'id, step_number, name, step_type, objective, inputs, output_format, quality_rules, failure_conditions, loop_back_step_number, created_at, updated_at'
      )
      .eq('agent_id', agent_id)
      .eq('user_id', user.id)
      .order('step_number', { ascending: true });

    if (stepsError) {
      console.error(`[scout/blueprint] Steps fetch error: ${stepsError.message}`);
      return NextResponse.json({ error: 'Failed to fetch agent steps' }, { status: 500 });
    }

    // 3. Return combined response.
    return NextResponse.json({
      agent: {
        name: agent.name,
        schedule: agent.schedule,
        category: agent.category,
      },
      steps: steps ?? [],
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[scout/blueprint] Catch block: ${message}`);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
