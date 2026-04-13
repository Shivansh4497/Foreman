import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Allowed updatable fields on agent_steps.
type StepUpdates = Partial<{
  name: string;
  step_type: 'automated' | 'manual_review';
  objective: string;
  inputs: string;
  output_format: string;
  quality_rules: string;
  failure_conditions: string;
}>;

const ALLOWED_STEP_FIELDS: (keyof StepUpdates)[] = [
  'name',
  'step_type',
  'objective',
  'inputs',
  'output_format',
  'quality_rules',
  'failure_conditions',
];

export async function PATCH(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      console.error('[scout/step] Missing authorization header');
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      console.error(`[scout/step] Auth error: ${authError?.message || 'No user returned'}`);
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { step_id, updates } = body as { step_id: string; updates: StepUpdates };

    if (!step_id || typeof step_id !== 'string') {
      return NextResponse.json({ error: 'step_id is required' }, { status: 400 });
    }

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return NextResponse.json({ error: 'updates object is required' }, { status: 400 });
    }

    if (updates.step_type && !['automated', 'manual_review'].includes(updates.step_type)) {
      return NextResponse.json({ error: 'step_type must be "automated" or "manual_review"' }, { status: 400 });
    }

    // 1. Verify ownership: step must belong to a draft agent owned by this user.
    // Join agent_steps → agents and check user_id.
    const { data: stepRow, error: stepFetchError } = await serviceClient
      .from('agent_steps')
      .select('id, agent_id')
      .eq('id', step_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (stepFetchError) {
      console.error(`[scout/step] Step fetch error: ${stepFetchError.message}`);
      return NextResponse.json({ error: 'Failed to verify step ownership' }, { status: 500 });
    }

    if (!stepRow) {
      return NextResponse.json({ error: 'Step not found or access denied' }, { status: 404 });
    }

    // Confirm the parent agent is still in draft status.
    const { data: agentRow, error: agentError } = await serviceClient
      .from('agents')
      .select('id, status')
      .eq('id', stepRow.agent_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (agentError) {
      console.error(`[scout/step] Agent fetch error: ${agentError.message}`);
      return NextResponse.json({ error: 'Failed to verify agent status' }, { status: 500 });
    }

    if (!agentRow) {
      return NextResponse.json({ error: 'Parent agent not found or access denied' }, { status: 404 });
    }

    // 2. Build a sanitised update object containing only allowed fields.
    const sanitisedUpdates: Record<string, unknown> = {};
    for (const field of ALLOWED_STEP_FIELDS) {
      if (field in updates && updates[field] !== undefined) {
        sanitisedUpdates[field] = updates[field];
      }
    }

    if (Object.keys(sanitisedUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided in updates. Allowed fields: ' + ALLOWED_STEP_FIELDS.join(', ') },
        { status: 400 }
      );
    }

    sanitisedUpdates['updated_at'] = new Date().toISOString();

    // 3. Update the agent_steps row.
    const { data: updatedStep, error: updateError } = await serviceClient
      .from('agent_steps')
      .update(sanitisedUpdates)
      .eq('id', step_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error(`[scout/step] Step update error: ${updateError.message}`);
      return NextResponse.json({ error: 'Failed to update step' }, { status: 500 });
    }

    // 4. Bump agents.updated_at (Scout is NOT re-invoked — per spec).
    await serviceClient
      .from('agents')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', stepRow.agent_id)
      .eq('user_id', user.id);

    // 5. Return updated step.
    return NextResponse.json({ success: true, step: updatedStep });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[scout/step] Catch block: ${message}`);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
