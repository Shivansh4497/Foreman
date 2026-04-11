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

    // Insert to vault and modify schema in one protected RPC sequence
    const { error: rpcError } = await supabaseAdmin.rpc('insert_vault_secret_admin', {
      user_id: user.id,
      secret_value: apiKey,
      provider_name: provider,
      model_name: model
    });

    if (rpcError) {
      console.error('[API keys/save] Vault insertion error', {
        error: rpcError.message,
        code: rpcError.code,
        details: rpcError.details,
        hint: rpcError.hint,
        provider,
        model,
        userId: user.id
      });
      return NextResponse.json({ error: 'Failed to securely store API key' }, { status: 500 });
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
