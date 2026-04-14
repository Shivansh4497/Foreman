import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callLLM } from '@/lib/llm';
import { startAgentRun } from '@/lib/runs/service';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify user
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { run_id, feedback } = await req.json();

    if (!run_id || !feedback) {
      return NextResponse.json({ error: 'run_id and feedback are required' }, { status: 400 });
    }

    // 1. Fetch run — must belong to this user, status must be 'completed'
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

    // 2. Fetch LLM config
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

    // 4. Distill feedback into a memory instruction via LLM
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
    let currentMemory = run.agents.agent_memory || '';
    let updatedMemory = `${memoryEntry}\n${currentMemory}`;
    if (updatedMemory.length > 2000) {
      updatedMemory = updatedMemory.substring(0, 2000);
    }

    const { error: updateErr } = await supabase
      .from('agents')
      .update({ agent_memory: updatedMemory })
      .eq('id', run.agent_id);

    if (updateErr) {
      console.error('[runs/reject] Failed to update agent memory:', updateErr.message);
      return NextResponse.json({ error: 'Failed to update agent memory' }, { status: 500 });
    }

    // 6. Start new run via unified service (enforces uniqueness + persists trigger_task_id)
    //    Use force=true so any stale active run is cancelled before starting fresh.
    const result = await startAgentRun(supabase, run.agent_id, user.id, /* force= */ true);

    if (!result.success) {
      console.error('[runs/reject] startAgentRun failed:', result.error);
      return NextResponse.json({ error: result.error || 'Failed to start new run' }, { status: 500 });
    }

    console.log(`[runs/reject] Started new run ${result.run_id} (#${result.run_number}) after rejection`);

    return NextResponse.json({
      success: true,
      new_run_id: result.run_id,
      run_number: result.run_number,
      memory_updated: memoryEntry
    });

  } catch (error) {
    console.error('[runs/reject] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
