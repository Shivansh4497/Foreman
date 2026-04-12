import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      console.error('[scout/hire] Missing authorization header');
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      console.error(`[scout/hire] Auth error: ${authError?.message || 'No user returned'}`);
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { agent_id } = body as { agent_id: string };

    if (!agent_id || typeof agent_id !== 'string') {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    // 1. Fetch agent and verify ownership.
    const { data: agent, error: agentError } = await serviceClient
      .from('agents')
      .select('id, user_id, name, schedule, blueprint_json, status')
      .eq('id', agent_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (agentError) {
      console.error(`[scout/hire] Agent fetch error: ${agentError.message}`);
      return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 });
    }

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found or access denied' }, { status: 404 });
    }

    // 2. Validate agent metadata required for hiring.
    const validationErrors: string[] = [];

    if (!agent.blueprint_json) {
      validationErrors.push('Agent has no blueprint yet. Chat with Scout to build one before hiring.');
    }

    if (!agent.name || agent.name.trim() === '') {
      validationErrors.push('Agent has no name. The blueprint must include an agent name.');
    }

    if (!agent.schedule || agent.schedule.trim() === '') {
      validationErrors.push('Agent has no schedule. The blueprint must include a schedule (e.g. "Every Monday at 9:00 AM" or "Manual only").');
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors.join(' ') },
        { status: 400 }
      );
    }

    // 3. Validate agent_steps: must have at least 1 row and every row must be fully populated.
    const { data: steps, error: stepsError } = await serviceClient
      .from('agent_steps')
      .select('id, step_number, objective, inputs, output_format, quality_rules, failure_conditions')
      .eq('agent_id', agent_id)
      .eq('user_id', user.id)
      .order('step_number', { ascending: true });

    if (stepsError) {
      console.error(`[scout/hire] Steps fetch error: ${stepsError.message}`);
      return NextResponse.json({ error: 'Failed to validate agent steps' }, { status: 500 });
    }

    if (!steps || steps.length === 0) {
      return NextResponse.json(
        {
          error:
            'Agent has no steps. Chat with Scout to build a complete workflow blueprint before hiring.',
        },
        { status: 400 }
      );
    }

    const requiredStepFields = [
      'objective',
      'inputs',
      'output_format',
      'quality_rules',
      'failure_conditions',
    ] as const;

    const incompleteSteps: number[] = [];

    for (const step of steps) {
      for (const field of requiredStepFields) {
        const value = step[field];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          incompleteSteps.push(step.step_number);
          break;
        }
      }
    }

    if (incompleteSteps.length > 0) {
      return NextResponse.json(
        {
          error: `The following steps are incomplete and must be filled in before hiring: Step${incompleteSteps.length > 1 ? 's' : ''} ${incompleteSteps.join(', ')}. Each step needs an objective, inputs, output format, quality rules, and failure conditions.`,
        },
        { status: 400 }
      );
    }

    // 4. All validation passed — promote agent from draft to active.
    const { error: updateError } = await serviceClient
      .from('agents')
      .update({
        status: 'active',
        agent_memory: '', // Initialize empty memory ready for first run (per PRD §Memory Architecture v1).
        updated_at: new Date().toISOString(),
      })
      .eq('id', agent_id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error(`[scout/hire] Agent status update error: ${updateError.message}`);
      return NextResponse.json({ error: 'Failed to hire agent' }, { status: 500 });
    }

    // 5. Return success.
    return NextResponse.json({ success: true, agent_id });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[scout/hire] Catch block: ${message}`);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
