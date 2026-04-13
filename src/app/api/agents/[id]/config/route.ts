import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(
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
      console.error(`[agents/config] Auth error: ${authError?.message || 'No user returned'}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, schedule } = body as { name?: string; schedule?: string };

    // Update only if fields are provided
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (schedule !== undefined) updates.schedule = schedule;
    
    // Note: output_format is skipped as it doesn't exist in the agents table
    // and the approved plan specifies skipping it.

    const { data: updatedAgent, error: updateError } = await serviceClient
      .from('agents')
      .update(updates)
      .eq('id', agentId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error(`[agents/config] Update error: ${updateError.message}`);
      return NextResponse.json({ error: 'Failed to update agent configuration' }, { status: 500 });
    }

    return NextResponse.json({ success: true, agent: updatedAgent });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[agents/config] Catch block: ${message}`);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
