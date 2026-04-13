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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { status } = body as { status: 'active' | 'paused' };

    if (!status || !['active', 'paused'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { data: updatedAgent, error: updateError } = await serviceClient
      .from('agents')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', agentId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error(`[agents/pause] Update error: ${updateError.message}`);
      return NextResponse.json({ error: 'Failed to update agent status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, agent: updatedAgent });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[agents/pause] Catch block: ${message}`);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
