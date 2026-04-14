import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callLLM } from '@/lib/llm';
import { tasks } from '@trigger.dev/sdk/v3';
import { startAgentRun } from '@/lib/runs/service';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { agent_id, content } = body;

    if (!agent_id || !content) {
      return NextResponse.json({ error: 'agent_id and content are required' }, { status: 400 });
    }

    // 1. Insert user message
    const { data: userMessage, error: userMsgErr } = await supabase
      .from('agent_conversations')
      .insert({
        agent_id,
        user_id: user.id,
        role: 'user',
        content,
        message_type: 'text'
      })
      .select()
      .single();

    if (userMsgErr) {
      console.error('[conversation/message] Error inserting user message:', userMsgErr);
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }

    // 2. Fetch Agent and LLM Config
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('name, agent_memory, status')
      .eq('id', agent_id)
      .single();

    if (agentErr || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const { data: llmConfig, error: configErr } = await supabase
      .from('user_llm_config')
      .select('provider, model, vault_secret_id')
      .eq('user_id', user.id)
      .single();

    if (configErr || !llmConfig) {
      return NextResponse.json({ error: 'LLM configuration not found' }, { status: 500 });
    }

    // 3. Decrypt API Key
    const { data: apiKey, error: rpcErr } = await supabase
      .rpc('get_service_secret', { secret_id: llmConfig.vault_secret_id });

    if (rpcErr || !apiKey) {
      return NextResponse.json({ error: 'Failed to retrieve API key' }, { status: 500 });
    }

    // 4. Classify Intent
    const intentPrompt = `Classify this user message into exactly one of these intents:
     FEEDBACK (giving feedback on output or style),
     INSTRUCTION (telling the agent to do something differently going forward),
     RUN_TRIGGER (wants to start a new run — look for 'run now', 'run again', 'go'),
     QUESTION (asking a question).
     Reply with only the intent word.`;

    const classifiedIntent = (await callLLM({
      provider: llmConfig.provider,
      model: llmConfig.model,
      apiKey: apiKey,
      systemPrompt: intentPrompt,
      userTurn: content
    })).trim().toUpperCase();

    // 5. Handle Intent
    if (classifiedIntent === 'FEEDBACK' || classifiedIntent === 'INSTRUCTION') {
      // Distill into memory
      const distillPrompt = `Distill this user feedback into a single, concise instruction for the AI agent ${agent.name}. Focus on style, tone, or specific content rules. No preamble or conversational filler.`;
      const distilled = (await callLLM({
        provider: llmConfig.provider,
        model: llmConfig.model,
        apiKey: apiKey,
        systemPrompt: distillPrompt,
        userTurn: content
      })).trim();

      const date = new Date().toISOString().split('T')[0];
      const memoryEntry = `[${date}] User instruction: ${distilled}`;
      
      const newMemory = `${memoryEntry}\n${agent.agent_memory || ''}`.substring(0, 2000);
      await supabase.from('agents').update({ agent_memory: newMemory }).eq('id', agent_id);

      const memoryContent = `Got it — I've noted that ${distilled.toLowerCase().replace(/\.$/, '')}. I'll apply this from your next run.`;
      
      // Insert memory update message
      await supabase.from('agent_conversations').insert({
        agent_id,
        user_id: user.id,
        role: 'agent',
        message_type: 'memory_update',
        content: memoryContent
      });

      return NextResponse.json({ success: true, intent: classifiedIntent });

    } else if (classifiedIntent === 'RUN_TRIGGER' || content.toLowerCase().includes('run now')) {
      const result = await startAgentRun(supabase, agent_id, user.id);

      if (result.message === 'Agent is already running') {
        await supabase.from('agent_conversations').insert({
          agent_id,
          user_id: user.id,
          role: 'agent',
          message_type: 'text',
          content: "I'm already running right now. I'll post the results here as soon as I finish!"
        });
        return NextResponse.json({ success: true, intent: 'RUN_TRIGGER', status: 'already_running' });
      }

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Failed to start run' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        intent: 'RUN_TRIGGER', 
        run_id: result.run_id,
        run_number: result.run_number 
      });

    } else if (classifiedIntent === 'QUESTION') {
      const questionPrompt = `You are ${agent.name}, an AI agent. Answer this question conversationally based on your memory and past runs. Keep it brief (2-3 sentences). Agent memory: ${agent.agent_memory || 'No memory yet.'}`;
      
      const agentReply = await callLLM({
        provider: llmConfig.provider,
        model: llmConfig.model,
        apiKey: apiKey,
        systemPrompt: questionPrompt,
        userTurn: content
      });

      await supabase.from('agent_conversations').insert({
        agent_id,
        user_id: user.id,
        role: 'agent',
        message_type: 'text',
        content: agentReply
      });

      return NextResponse.json({ success: true, intent: 'QUESTION' });
    }

    // Default: treat as text/question if unknown
    const defaultReply = "I'm not sure if I follow. Could you please clarify if you're giving feedback, asking a question, or would like me to start a run?";
    await supabase.from('agent_conversations').insert({
      agent_id,
      user_id: user.id,
      role: 'agent',
      message_type: 'text',
      content: defaultReply
    });

    return NextResponse.json({ success: true, intent: 'UNKNOWN' });

  } catch (err: any) {
    console.error('[conversation/message] Catch block:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
