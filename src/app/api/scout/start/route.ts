import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Auth pattern: same as /api/keys/save — service client + Bearer token verification.
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      console.error('[scout/start] Missing authorization header');
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      console.error(`[scout/start] Auth error: ${authError?.message || 'No user returned'}`);
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 401 });
    }

    // Step 3.1 rule: Check that the user has a valid API key in user_llm_config.
    const { data: llmConfig, error: configError } = await serviceClient
      .from('user_llm_config')
      .select('vault_secret_id, provider, model')
      .eq('user_id', user.id)
      .maybeSingle();

    if (configError) {
      console.error(`[scout/start] LLM config query error: ${configError.message}`);
      return NextResponse.json({ error: 'Failed to verify API key configuration' }, { status: 500 });
    }

    if (!llmConfig || !llmConfig.vault_secret_id) {
      return NextResponse.json({ error: 'no_api_key' }, { status: 400 });
    }

    // Insert a new draft agent row.
    const { data: agent, error: agentError } = await serviceClient
      .from('agents')
      .insert({
        user_id: user.id,
        status: 'draft',
        blueprint_json: null,
      })
      .select('id')
      .single();

    if (agentError || !agent) {
      console.error(`[scout/start] Agent insert error: ${agentError?.message}`);
      return NextResponse.json({ error: 'Failed to create draft agent' }, { status: 500 });
    }

    const openingMessage = 'What should this agent do?';

    // Insert Scout's opening message into conversations.
    const { error: convError } = await serviceClient
      .from('conversations')
      .insert({
        agent_id: agent.id,
        user_id: user.id,
        role: 'scout',
        content: openingMessage,
      });

    if (convError) {
      console.error(`[scout/start] Conversation insert error: ${convError.message}`);
      return NextResponse.json({ error: 'Failed to initialise conversation' }, { status: 500 });
    }

    return NextResponse.json({ agent_id: agent.id, opening_message: openingMessage });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[scout/start] Catch block: ${message}`);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
