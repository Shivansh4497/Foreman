import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callLLM } from '@/lib/llm';
import { tasks } from '@trigger.dev/sdk/v3';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get user from token
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { run_id, feedback } = await req.json();

    if (!run_id || !feedback) {
      return NextResponse.json({ error: 'run_id and feedback are required' }, { status: 400 });
    }

    // 1. Fetch run from agent_runs — must belong to this user, status must be 'completed'
    const { data: run, error: runErr } = await supabase
      .from('agent_runs')
      .select('*, agents(agent_memory)')
      .eq('id', run_id)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .single();

    if (runErr || !run) {
      return NextResponse.json({ error: 'Run not found or not eligible for rejection' }, { status: 404 });
    }

    // 2. Fetch user_llm_config for user.id
    const { data: llmConfig, error: configErr } = await supabase
      .from('user_llm_config')
      .select('provider, model, vault_secret_id')
      .eq('user_id', user.id)
      .single();

    if (configErr || !llmConfig) {
      return NextResponse.json({ error: 'LLM configuration not found' }, { status: 400 });
    }

    // 3. Decrypt API key via vault RPC
    const { data: apiKey, error: rpcErr } = await supabase
      .rpc('get_service_secret', { secret_id: llmConfig.vault_secret_id });

    if (rpcErr || !apiKey) {
      return NextResponse.json({ error: 'Failed to decrypt API key' }, { status: 500 });
    }

    // 4. Call LLM to generate a memory instruction
    const memoryInstruction = await callLLM({
      provider: llmConfig.provider,
      model: llmConfig.model,
      apiKey: apiKey,
      systemPrompt: "You are updating an AI agent's permanent memory based on user rejection feedback. Write a single clear instruction (1-2 sentences) that captures what the agent must do differently in future runs. Focus on concrete actionable changes to tone, format, length, or content. Start with 'User requires:' or 'Always:' or 'Never:'. No preamble.",
      userTurn: `User rejected the run output with this feedback: "${feedback}"`,
    });

    const date = new Date().toISOString().split('T')[0];
    const memoryEntry = `[${date}] Rejection feedback: ${memoryInstruction}`;

    // 5. Update agents.agent_memory (prepend and trim to 2000 chars)
    let currentMemory = run.agents.agent_memory || "";
    let updatedMemory = `${memoryEntry}\n${currentMemory}`;
    if (updatedMemory.length > 2000) {
      updatedMemory = updatedMemory.substring(0, 2000);
    }

    const { error: updateErr } = await supabase
      .from('agents')
      .update({ agent_memory: updatedMemory, status: 'running' })
      .eq('id', run.agent_id);

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update agent memory' }, { status: 500 });
    }

    // 6. Insert new agent_runs record
    const { data: newRun, error: insertErr } = await supabase
      .from('agent_runs')
      .insert({
        agent_id: run.agent_id,
        user_id: user.id,
        status: 'running',
        global_state: { 
          current_step: 1, 
          step_statuses: {}, 
          rejection_context: feedback 
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertErr || !newRun) {
      return NextResponse.json({ error: 'Failed to create new run record' }, { status: 500 });
    }

    // 7. Trigger Trigger.dev job
    await tasks.trigger('run-agent-workflow', { run_id: newRun.id });

    return NextResponse.json({ 
      success: true, 
      new_run_id: newRun.id, 
      memory_updated: memoryEntry 
    });

  } catch (error) {
    console.error('Rejection error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
