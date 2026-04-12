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
      console.error(`[settings/config] Auth error: ${authError?.message || 'No user'}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: config, error: configError } = await serviceClient
      .from('user_llm_config')
      .select('provider, model, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (configError) {
      console.error(`[settings/config] DB error: ${configError.message}`);
      return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }

    // config may be null if user has not completed onboarding
    return NextResponse.json({
      provider: config?.provider ?? null,
      model: config?.model ?? null,
      updated_at: config?.updated_at ?? null,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[settings/config] Catch: ${message}`);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
