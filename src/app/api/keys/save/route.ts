import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { provider, model, apiKey } = await request.json();
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('[API keys/save] Missing authorization header');
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = authHeader.replace('Bearer ', '');
    // Verify the user token validates to a real auth session
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      console.error(`[API keys/save] Auth error: ${authError?.message || 'No user returned'}`);
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 401 });
    }

    // Insert into Supabase Vault using Supabase's native insert_secret RPC
    const { data: secretId, error: vaultError } = await serviceClient.rpc('insert_secret', {
      name: `llm_key_${user.id}_${Date.now()}`,
      secret: apiKey.trim(),
      description: `LLM API Key for ${provider}`
    });

    if (vaultError || !secretId) {
      console.error(`[API keys/save] Vault insertion error: ${vaultError?.message || 'Failed to get secret UUID'}`);
      return NextResponse.json({ error: 'Failed to securely store API key in Vault' }, { status: 500 });
    }

    // Upsert into user_llm_config with the returned UUID
    const { error: configError } = await serviceClient
      .from('user_llm_config')
      .upsert({
        user_id: user.id,
        provider: provider,
        model: model,
        vault_secret_id: secretId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (configError) {
      console.error(`[API keys/save] Config upsert error: ${configError.message}`);
      return NextResponse.json({ error: 'Failed to update user configuration' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Key saved securely in Vault.' });
    
  } catch (err: any) {
    console.error(`[API keys/save] Catch block error: ${err?.message || 'Unknown error'}`);
    return NextResponse.json({ error: 'An unexpected error occurred while saving the key' }, { status: 500 });
  }
}
