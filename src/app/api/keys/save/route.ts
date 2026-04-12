import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { provider, model, apiKey } = await request.json();
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('[API keys/save] Missing authorization header', { 
        error: 'Missing Authorization header', 
        provider, 
        model 
      });
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_service_key';
    
    // Admin client correctly executes highly-privileged Vault inserts
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    // Verify the user token validates to a real auth session
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('[API keys/save] Auth error', { 
        error: authError?.message || 'No user returned',
        code: authError?.status,
        details: authError,
        provider,
        model 
      });
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 401 });
    }

    // Insert into Supabase Vault using REST API
    const { data: vaultData, error: vaultError } = await supabaseAdmin
      .from('vault.secrets')
      .insert({ secret: apiKey, name: `llm_key_${user.id}_${provider}` })
      .select('id')
      .single();

    if (vaultError || !vaultData) {
      // If REST API fails, fallback to RPC vault_create_secret? No, user said "if that doesn't work use..." 
      // I will implement the REST API as requested and add logs.
      console.error('[API keys/save] Vault insertion error', {
        error: vaultError?.message || 'No data returned',
        code: vaultError?.code,
        details: vaultError?.details,
        hint: vaultError?.hint,
        provider,
        model,
        userId: user.id
      });
      return NextResponse.json({ error: 'Failed to securely store API key in \nVault' }, { status: 500 });
    }

    // Upsert into user_llm_config
    const { error: configError } = await supabaseAdmin
      .from('user_llm_config')
      .upsert({
        user_id: user.id,
        provider,
        model,
        vault_secret_id: vaultData.id,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (configError) {
      console.error('[API keys/save] Config upsert error', {
        error: configError.message,
        code: configError.code,
        details: configError.details,
        provider,
        model,
        userId: user.id
      });
      return NextResponse.json({ error: 'Failed to update user configuration' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Key saved securely in Vault.' });
    
  } catch (err: any) {
    console.error('[API keys/save] Catch block error', {
      error: err?.message || String(err),
      code: err?.code,
      details: err
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
