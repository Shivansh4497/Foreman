import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { startAgentRun } from '@/lib/runs/service';

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
    const { agent_id, force } = body;

    if (!agent_id) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }

    const result = await startAgentRun(serviceClient, agent_id, user.id, !!force);

    if (!result.success) {
      // Map stable error codes to correct HTTP statuses
      if (result.code === 'ACTIVE_RUN_EXISTS') {
        return NextResponse.json({ error: result.error || result.message, run_id: result.run_id }, { status: 409 });
      }
      if (result.code === 'AGENT_NOT_FOUND' || result.error?.includes('not found')) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      run_id: result.run_id,
      run_number: result.run_number,
      message: result.message
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[runs/start] Catch block: ${message}`);
    return NextResponse.json({ error: `An unexpected error occurred: ${message}` }, { status: 500 });
  }
}
