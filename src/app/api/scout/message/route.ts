import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConversationRow {
  role: 'scout' | 'user';
  content: string;
  created_at: string;
}

interface UserContext {
  business_description: string | null;
  target_customer: string | null;
  goals_90_day: string | null;
  competitors: string | null;
  voice_tone: string | null;
}

interface BlueprintStep {
  step_number: number;
  name: string;
  step_type: 'automated' | 'manual_review';
  objective: string;
  inputs: string;
  output_format: string;
  quality_rules: string;
  failure_conditions: string;
  loop_back_step_number: number | null;
}

interface Blueprint {
  agent_name: string;
  schedule: string;
  output_format: string;
  category: string;
  human_hours_per_run: number;
  steps: BlueprintStep[];
}

// ─── Prompt loader (reads from filesystem at runtime) ─────────────────────────

function loadPrompt(filename: string): string {
  const promptsDir = join(process.cwd(), 'src', 'lib', 'scout', 'prompts');
  return readFileSync(join(promptsDir, filename), 'utf-8');
}

// Extract only the system prompt block from the structured prompt documents.
// Each prompt file has a "## System Prompt" section surrounded by triple backticks.
function extractSystemPrompt(fileContent: string): string {
  const match = fileContent.match(/## System Prompt\s*\n```\n([\s\S]*?)\n```/);
  if (match) return match[1].trim();
  // Fallback: return the full file content if extraction fails.
  console.warn('[scout/message] Could not extract system prompt block — using full file content');
  return fileContent;
}

// ─── LLM call helper ──────────────────────────────────────────────────────────

async function callLLM(opts: {
  provider: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
  userTurn: string;
  expectJson?: boolean;
}): Promise<string> {
  const { provider, model, apiKey, systemPrompt, userTurn } = opts;

  // Normalise provider names to expected API endpoint patterns.
  const providerLower = provider.toLowerCase();
  const isAnthropic = providerLower === 'anthropic';
  const isOpenAI = !isAnthropic; // treat anything non-anthropic as OpenAI-compatible

  if (isOpenAI) {
    let endpoint = 'https://api.openai.com/v1/chat/completions';
    if (providerLower === 'groq') {
      endpoint = 'https://api.groq.com/openai/v1/chat/completions';
    } else if (providerLower === 'gemini') {
      endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userTurn },
        ],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM API error (provider=${providerLower}) ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  // Anthropic path
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userTurn }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? '';
}

// ─── Layer 4: Context injection (per layer4_context_injection_spec.md) ────────

async function buildUserContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceClient: any,
  userId: string,
  category: string,
  conversationHistory: ConversationRow[]
): Promise<UserContext> {
  type UsersRowType = {
    business_description: string | null;
    target_customer: string | null;
    goals_90_day: string | null;
    competitors: string | null;
  };

  let usersData: UsersRowType | null = null;

  try {
    const { data } = await serviceClient
      .from('users')
      .select('business_description, target_customer, goals_90_day, competitors')
      .eq('id', userId)
      .maybeSingle();
    // Supabase JS has no generated types for this project — cast through unknown.
    usersData = (data as unknown as UsersRowType | null) ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[scout/message] Layer 4: users query failed: ${message}`);
    // Spec: log and continue with nulls.
  }

  // Step 2a — Query agents table for voice_tone (same category first).
  let voiceTone: string | null = null;

  try {
    const { data: agentDataRaw } = await serviceClient
      .from('agents')
      .select('agent_memory')
      .eq('user_id', userId)
      .eq('category', category)
      .in('status', ['active', 'paused'])
      .not('agent_memory', 'is', null)
      .neq('agent_memory', '')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const agentData = agentDataRaw as { agent_memory: string } | null;
    if (agentData?.agent_memory) {
      voiceTone = agentData.agent_memory;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[scout/message] Layer 4: agents voice_tone query (same category) failed: ${message}`);
  }

  // Step 2b — Cross-category fallback if no same-category agent found.
  if (!voiceTone) {
    try {
      const { data: fallbackDataRaw } = await serviceClient
        .from('agents')
        .select('agent_memory')
        .eq('user_id', userId)
        .in('status', ['active', 'paused'])
        .not('agent_memory', 'is', null)
        .ilike('agent_memory', '%voice%')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const fallbackData = fallbackDataRaw as { agent_memory: string } | null;
      if (fallbackData?.agent_memory) {
        voiceTone = fallbackData.agent_memory;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[scout/message] Layer 4: agents voice_tone cross-category fallback failed: ${message}`);
    }
  }

  // Step 3 — Conversation history fallback for null fields.
  const conversationText = conversationHistory
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ');

  function extractFromConversation(patterns: RegExp[]): string | null {
    for (const pattern of patterns) {
      const match = conversationText.match(pattern);
      if (match) return match[0].trim();
    }
    return null;
  }

  const convExtract = {
    business_description:
      extractFromConversation([
        /(?:my startup|my company|my product|I build|we do|we build)[^.!?]*/i,
      ]),
    target_customer:
      extractFromConversation([
        /(?:for|my audience is|my customers are|targeting|target)[^.!?]*/i,
      ]),
    goals_90_day:
      extractFromConversation([
        /(?:my goal|I want to|trying to|this quarter|90 days)[^.!?]*/i,
      ]),
    competitors:
      extractFromConversation([
        /(?:competitors?(?: are| include)?|competing with|vs\.?)[^.!?]*/i,
      ]),
    voice_tone:
      extractFromConversation([
        /(?:in my voice|direct|punchy|no fluff|no jargon|casual|formal|founder voice)[^.!?]*/i,
      ]),
  };

  // Step 4 — Assemble with priority: users table > agents memory > conversation > null.
  const userContext: UserContext = {
    business_description:
      (usersData?.business_description ?? convExtract.business_description) ?? null,
    target_customer:
      (usersData?.target_customer ?? convExtract.target_customer) ?? null,
    goals_90_day:
      (usersData?.goals_90_day ?? convExtract.goals_90_day) ?? null,
    competitors:
      (usersData?.competitors ?? convExtract.competitors) ?? null,
    voice_tone:
      voiceTone ?? convExtract.voice_tone ?? null,
  };

  return userContext;
}

// ─── Layer 5: Quality gate runner ──────────────────────────────────────────────

async function runQualityGate(
  step: BlueprintStep,
  layer5SystemPrompt: string,
  provider: string,
  model: string,
  apiKey: string
): Promise<{ passes: boolean; failures: string[] }> {
  const userTurn = JSON.stringify(step);

  try {
    const raw = await callLLM({
      provider,
      model,
      apiKey,
      systemPrompt: layer5SystemPrompt,
      userTurn,
      expectJson: true,
    });

    const parsed = JSON.parse(raw);

    // Handle error response from gate (per spec: treat as fully failed).
    if (parsed.error) {
      console.warn(`[scout/message] Layer 5 gate returned error for step ${step.step_number}: ${parsed.reason}`);
      return {
        passes: false,
        failures: [
          'OBJECTIVE_CLARITY',
          'INPUTS_SPECIFICITY',
          'OUTPUT_FORMAT_PRECISION',
          'QUALITY_RULES_MEASURABILITY',
          'FAILURE_CONDITIONS_DEFINITION',
        ],
      };
    }

    // Spec: if passes is true but failures is non-empty, that is contradictory — run again.
    if (parsed.passes === true && Array.isArray(parsed.failures) && parsed.failures.length > 0) {
      console.warn(`[scout/message] Layer 5 contradictory response for step ${step.step_number} — treating as failed`);
      return { passes: false, failures: parsed.failures };
    }

    return {
      passes: Boolean(parsed.passes),
      failures: Array.isArray(parsed.failures) ? parsed.failures : [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[scout/message] Layer 5 gate parse error for step ${step.step_number}: ${message}`);
    return {
      passes: false,
      failures: [
        'OBJECTIVE_CLARITY',
        'INPUTS_SPECIFICITY',
        'OUTPUT_FORMAT_PRECISION',
        'QUALITY_RULES_MEASURABILITY',
        'FAILURE_CONDITIONS_DEFINITION',
      ],
    };
  }
}

// ─── Layer 3 step regeneration (single failing step) ─────────────────────────

async function regenerateFailingStep(opts: {
  failingStep: BlueprintStep;
  failures: string[];
  blueprint: Blueprint;
  category: string;
  userMessage: string;
  conversationHistory: ConversationRow[];
  userContext: UserContext;
  clarifyingQA: Array<{ question: string; answer: string }>;
  layer3SystemPrompt: string;
  provider: string;
  model: string;
  apiKey: string;
}): Promise<BlueprintStep> {
  const {
    failingStep,
    failures,
    blueprint,
    category,
    userMessage,
    conversationHistory,
    userContext,
    clarifyingQA,
    layer3SystemPrompt,
    provider,
    model,
    apiKey,
  } = opts;

  const regenPrompt = `
You are regenerating a single failing step in a Workforce Blueprint.

ORIGINAL FAILING STEP:
${JSON.stringify(failingStep, null, 2)}

FAILED QUALITY CRITERIA:
${failures.join(', ')}

PASS CONDITIONS FOR EACH FAILED CRITERION:
- OBJECTIVE_CLARITY: The objective must define a specific, measurable outcome — not a vague action.
- INPUTS_SPECIFICITY: Name actual data sources, global state fields, or real user context values. No [insert X] placeholders.
- OUTPUT_FORMAT_PRECISION: Specify exact structure (JSON schema, word counts, field names).
- QUALITY_RULES_MEASURABILITY: All rules must be checkable in under 5 seconds. No subjective rules.
- FAILURE_CONDITIONS_DEFINITION: State exactly what failure looks like and exactly what the agent must do.

FULL BLUEPRINT CONTEXT:
${JSON.stringify(blueprint, null, 2)}

Category: ${category}
User message: ${userMessage}
User context: ${JSON.stringify(userContext)}
Clarifying Q&A: ${JSON.stringify(clarifyingQA)}

TASK: Return ONLY the corrected step JSON object (same shape as the original step). Fix only the failing criteria. Keep passing criteria unchanged. Return valid JSON only.
`.trim();

  try {
    const raw = await callLLM({
      provider,
      model,
      apiKey,
      systemPrompt: layer3SystemPrompt,
      userTurn: regenPrompt,
      expectJson: true,
    });

    const parsed = JSON.parse(raw);
    // Ensure we always have the correct step_number.
    return { ...parsed, step_number: failingStep.step_number };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[scout/message] Step regen parse error for step ${failingStep.step_number}: ${message}`);
    return failingStep; // Return original on parse failure.
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    // 1. Auth check (same pattern as /api/keys/save).
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      console.error('[scout/message] Missing authorization header');
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      console.error(`[scout/message] Auth error: ${authError?.message || 'No user returned'}`);
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { agent_id, message } = body as { agent_id: string; message: string };

    if (!agent_id || typeof agent_id !== 'string') {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
    }
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json({ error: 'message is required and must be non-empty' }, { status: 400 });
    }

    // Verify ownership: user must own the agent.
    const { data: agentRow, error: agentFetchError } = await serviceClient
      .from('agents')
      .select('id, user_id, category, blueprint_json')
      .eq('id', agent_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (agentFetchError) {
      console.error(`[scout/message] Agent fetch error: ${agentFetchError.message}`);
      return NextResponse.json({ error: 'Failed to verify agent ownership' }, { status: 500 });
    }
    if (!agentRow) {
      return NextResponse.json({ error: 'Agent not found or access denied' }, { status: 404 });
    }

    // Retrieve user's API key via get_service_secret RPC — never log the plaintext key.
    const { data: llmConfig, error: configError } = await serviceClient
      .from('user_llm_config')
      .select('vault_secret_id, provider, model')
      .eq('user_id', user.id)
      .maybeSingle();

    if (configError || !llmConfig?.vault_secret_id) {
      console.error(`[scout/message] LLM config error: ${configError?.message || 'No config'}`);
      return NextResponse.json({ error: 'no_api_key' }, { status: 400 });
    }

    const { data: secretData, error: secretError } = await serviceClient.rpc('get_service_secret', {
      secret_id: llmConfig.vault_secret_id,
    });

    if (secretError || !secretData) {
      console.error(`[scout/message] Secret retrieval failed: ${secretError?.message || 'No data'}`);
      return NextResponse.json({ error: 'Failed to retrieve API credentials' }, { status: 500 });
    }

    const plainApiKey: string = secretData; // Never log this value.
    const provider: string = llmConfig.provider;
    const model: string = llmConfig.model;

    // 2. Load conversation history in chronological order.
    const { data: historyRows, error: historyError } = await serviceClient
      .from('conversations')
      .select('role, content, created_at')
      .eq('agent_id', agent_id)
      .order('created_at', { ascending: true });

    if (historyError) {
      console.error(`[scout/message] Conversation history error: ${historyError.message}`);
      return NextResponse.json({ error: 'Failed to load conversation history' }, { status: 500 });
    }

    const conversationHistory: ConversationRow[] = (historyRows ?? []) as ConversationRow[];

    // Count user turns in history (before inserting this new message).
    const priorUserTurns = conversationHistory.filter((m) => m.role === 'user').length;
    const turnCount = priorUserTurns + 1; // This message is turn N.

    // 3. Store user message.
    const { error: insertUserMsgError } = await serviceClient
      .from('conversations')
      .insert({
        agent_id,
        user_id: user.id,
        role: 'user',
        content: message.trim(),
      });

    if (insertUserMsgError) {
      console.error(`[scout/message] User message insert error: ${insertUserMsgError.message}`);
      return NextResponse.json({ error: 'Failed to store user message' }, { status: 500 });
    }

    // Load prompts from filesystem (done once per request, before LLM calls).
    const layer1Raw = loadPrompt('layer1_intent_classification.txt');
    const layer2Raw = loadPrompt('layer2_question_bank.txt');
    const layer3Raw = loadPrompt('layer3_blueprint_generation.txt');
    const layer5Raw = loadPrompt('layer5_quality_gate.txt');
    const scoutConvRaw = loadPrompt('scout_conversation.txt');

    const layer1System = extractSystemPrompt(layer1Raw);
    const layer2System = extractSystemPrompt(layer2Raw);
    const layer3System = extractSystemPrompt(layer3Raw);
    const layer5System = extractSystemPrompt(layer5Raw);
    const scoutConvSystem = extractSystemPrompt(scoutConvRaw);

    // 4. Layer 1 — Intent classification (called on every turn).
    let category: string = agentRow.category ?? 'custom';

    try {
      const l1Raw = await callLLM({
        provider,
        model,
        apiKey: plainApiKey,
        systemPrompt: layer1System,
        userTurn: message.trim(),
        expectJson: true,
      });

      const l1Parsed = JSON.parse(l1Raw);
      if (l1Parsed.error) {
        category = 'custom';
      } else {
        category = l1Parsed.category ?? 'custom';
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown';
      console.error(`[scout/message] Layer 1 error: ${errMsg}`);
      category = agentRow.category ?? 'custom';
    }

    // If the agent's category is not yet set, persist it now.
    if (!agentRow.category) {
      await serviceClient
        .from('agents')
        .update({ category })
        .eq('id', agent_id);
    }

    // 5. Layer 4 — Context injection (per layer4_context_injection_spec.md).
    // Append the user message to the history snapshot used for conversation scanning.
    const fullHistory: ConversationRow[] = [
      ...conversationHistory,
      { role: 'user', content: message.trim(), created_at: new Date().toISOString() },
    ];

    const userContext = await buildUserContext(serviceClient, user.id, category, fullHistory);

    // 6. Layer 2 — Question bank.
    const conversationHistoryForPrompt = conversationHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const l2UserTurn = `Category: ${category}

User message: ${message.trim()}

Conversation history: ${JSON.stringify(conversationHistoryForPrompt)}

User context: ${JSON.stringify(userContext)}`;

    let questions: string[] = [];

    try {
      const l2Raw = await callLLM({
        provider,
        model,
        apiKey: plainApiKey,
        systemPrompt: layer2System,
        userTurn: l2UserTurn,
        expectJson: true,
      });

      const l2Parsed = JSON.parse(l2Raw);
      if (!l2Parsed.error && Array.isArray(l2Parsed.questions)) {
        questions = l2Parsed.questions;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown';
      console.error(`[scout/message] Layer 2 error: ${errMsg}`);
      questions = [];
    }

    // 7. Conversation turn count check — force blueprint if turn_count >= 4.
    const forceBlueprintGeneration = turnCount >= 4;
    if (forceBlueprintGeneration && questions.length > 0) {
      questions = []; // Override — must generate blueprint now.
    }

    // 8. Routing decision.
    const shouldGenerateBlueprint = questions.length === 0;

    if (!shouldGenerateBlueprint) {
      // Path A: Ask the first unanswered question only.
      const scoutQuestion = questions[0];

      // Generate Scout's conversational reply using scout_conversation.txt.
      const scoutUserTurn = `Conversation history: ${JSON.stringify(conversationHistoryForPrompt)}

User's latest message: ${message.trim()}

Turn count: ${turnCount}

Blueprint updated this turn: false

Questions from Layer 2: ${JSON.stringify(questions)}

Blueprint summary (if updated): null`;

      let scoutReply = scoutQuestion; // Fallback to the raw question if LLM fails.

      try {
        scoutReply = await callLLM({
          provider,
          model,
          apiKey: plainApiKey,
          systemPrompt: scoutConvSystem,
          userTurn: scoutUserTurn,
        });
        scoutReply = scoutReply.trim();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown';
        console.error(`[scout/message] Scout conv (question path) error: ${errMsg}`);
        scoutReply = scoutQuestion;
      }

      // Store Scout's reply.
      const { error: scoutMsgError } = await serviceClient
        .from('conversations')
        .insert({
          agent_id,
          user_id: user.id,
          role: 'scout',
          content: scoutReply,
        });

      if (scoutMsgError) {
        console.error(`[scout/message] Scout message insert error: ${scoutMsgError.message}`);
      }

      return NextResponse.json({ scout_message: scoutReply, blueprint_updated: false });
    }

    // Path B: Generate blueprint (Layer 3 → Layer 5 → persist).

    // Build clarifying_qa from conversation history: pair scout questions with following user answers.
    const clarifyingQA: Array<{ question: string; answer: string }> = [];
    const historyForQA = [...conversationHistoryForPrompt];
    for (let i = 0; i < historyForQA.length - 1; i++) {
      if (historyForQA[i].role === 'scout' && historyForQA[i + 1].role === 'user') {
        // Skip the opening message "What should this agent do?"
        const q = historyForQA[i].content;
        if (q !== 'What should this agent do?') {
          clarifyingQA.push({ question: q, answer: historyForQA[i + 1].content });
        }
      }
    }

    // 9. Layer 3 — Blueprint generation.
    const l3UserTurn = `Category: ${category}

User message: ${message.trim()}

Conversation history: ${JSON.stringify(conversationHistoryForPrompt)}

User context: ${JSON.stringify(userContext)}

Clarifying Q&A: ${JSON.stringify(clarifyingQA)}`;

    let blueprint: Blueprint | null = null;

    try {
      const l3Raw = await callLLM({
        provider,
        model,
        apiKey: plainApiKey,
        systemPrompt: layer3System,
        userTurn: l3UserTurn,
        expectJson: true,
      });

      const l3Parsed = JSON.parse(l3Raw);

      if (l3Parsed.error) {
        console.error(`[scout/message] Layer 3 returned error: ${l3Parsed.reason}`);
        return NextResponse.json({ error: 'Blueprint generation failed — insufficient context' }, { status: 422 });
      }

      blueprint = l3Parsed as Blueprint;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown';
      console.error(`[scout/message] Layer 3 error: ${errMsg}`);
      return NextResponse.json({ error: 'Blueprint generation failed' }, { status: 500 });
    }

    if (!blueprint || !Array.isArray(blueprint.steps) || blueprint.steps.length === 0) {
      return NextResponse.json({ error: 'Blueprint generation returned no steps' }, { status: 500 });
    }

    // 10. Layer 5 — Quality gate: per-step validation with up to 2 retries.
    const validatedSteps: BlueprintStep[] = [];

    for (const step of blueprint.steps) {
      let currentStep = step;
      let gateResult = await runQualityGate(currentStep, layer5System, provider, model, plainApiKey);

      if (!gateResult.passes) {
        // Retry 1
        console.log(`[scout/message] Layer 5 step ${step.step_number} failed (attempt 1): ${gateResult.failures.join(', ')}`);
        currentStep = await regenerateFailingStep({
          failingStep: currentStep,
          failures: gateResult.failures,
          blueprint,
          category,
          userMessage: message.trim(),
          conversationHistory: fullHistory,
          userContext,
          clarifyingQA,
          layer3SystemPrompt: layer3System,
          provider,
          model,
          apiKey: plainApiKey,
        });

        gateResult = await runQualityGate(currentStep, layer5System, provider, model, plainApiKey);

        if (!gateResult.passes) {
          // Retry 2
          console.log(`[scout/message] Layer 5 step ${step.step_number} failed (attempt 2): ${gateResult.failures.join(', ')}`);
          currentStep = await regenerateFailingStep({
            failingStep: currentStep,
            failures: gateResult.failures,
            blueprint,
            category,
            userMessage: message.trim(),
            conversationHistory: fullHistory,
            userContext,
            clarifyingQA,
            layer3SystemPrompt: layer3System,
            provider,
            model,
            apiKey: plainApiKey,
          });

          gateResult = await runQualityGate(currentStep, layer5System, provider, model, plainApiKey);

          if (!gateResult.passes) {
            // Per spec: log and use best available version after 2 retries.
            console.warn(
              JSON.stringify({
                agent_id,
                step_number: step.step_number,
                failures_after_retries: gateResult.failures,
                action: 'using_best_available_version',
              })
            );
          }
        }
      }

      validatedSteps.push(currentStep);
    }

    // Replace blueprint steps with validated version.
    const validatedBlueprint: Blueprint = { ...blueprint, steps: validatedSteps };

    // 11. Persist blueprint — update agents row.
    const { error: blueprintUpdateError } = await serviceClient
      .from('agents')
      .update({
        blueprint_json: validatedBlueprint,
        name: validatedBlueprint.agent_name,
        category: validatedBlueprint.category,
        schedule: validatedBlueprint.schedule,
        human_hours_per_run: validatedBlueprint.human_hours_per_run,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agent_id)
      .eq('user_id', user.id);

    if (blueprintUpdateError) {
      console.error(`[scout/message] Blueprint persist error: ${blueprintUpdateError.message}`);
      return NextResponse.json({ error: 'Failed to persist blueprint' }, { status: 500 });
    }

    // 12. Upsert agent_steps: delete existing rows then insert fresh rows.
    const { error: deleteStepsError } = await serviceClient
      .from('agent_steps')
      .delete()
      .eq('agent_id', agent_id);

    if (deleteStepsError) {
      console.error(`[scout/message] agent_steps delete error: ${deleteStepsError.message}`);
      return NextResponse.json({ error: 'Failed to clear existing steps' }, { status: 500 });
    }

    const stepsToInsert = validatedSteps.map((s) => ({
      agent_id,
      user_id: user.id,
      step_number: s.step_number,
      name: s.name,
      step_type: s.step_type,
      objective: s.objective,
      inputs: s.inputs,
      output_format: s.output_format,
      quality_rules: s.quality_rules,
      failure_conditions: s.failure_conditions,
      loop_back_step_number: s.loop_back_step_number ?? null,
    }));

    const { error: insertStepsError } = await serviceClient
      .from('agent_steps')
      .insert(stepsToInsert);

    if (insertStepsError) {
      console.error(`[scout/message] agent_steps insert error: ${insertStepsError.message}`);
      return NextResponse.json({ error: 'Failed to persist steps' }, { status: 500 });
    }

    // 13. Generate Scout's conversational reply announcing the blueprint.
    const blueprintSummary = {
      agent_name: validatedBlueprint.agent_name,
      schedule: validatedBlueprint.schedule,
      step_count: validatedSteps.length,
    };

    const updatedHistory = [
      ...conversationHistoryForPrompt,
      { role: 'user', content: message.trim() },
    ];

    const scoutConvUserTurn = `Conversation history: ${JSON.stringify(updatedHistory)}

User's latest message: ${message.trim()}

Turn count: ${turnCount}

Blueprint updated this turn: true

Questions from Layer 2: []

Blueprint summary (if updated): ${JSON.stringify(blueprintSummary)}`;

    let scoutReply = `Blueprint's on the right — does this look right?`; // Spec-required fallback.

    try {
      const raw = await callLLM({
        provider,
        model,
        apiKey: plainApiKey,
        systemPrompt: scoutConvSystem,
        userTurn: scoutConvUserTurn,
      });
      scoutReply = raw.trim() || scoutReply;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown';
      console.error(`[scout/message] Scout conversation LLM error: ${errMsg}`);
      // Use fallback — do not surface error to user.
    }

    // 14. Store Scout's reply in conversations.
    const { error: scoutReplyError } = await serviceClient
      .from('conversations')
      .insert({
        agent_id,
        user_id: user.id,
        role: 'scout',
        content: scoutReply,
      });

    if (scoutReplyError) {
      console.error(`[scout/message] Scout reply insert error: ${scoutReplyError.message}`);
    }

    // 15. Return response.
    return NextResponse.json({
      scout_message: scoutReply,
      blueprint_updated: true,
      blueprint: validatedBlueprint,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[scout/message] Catch block: ${message}`);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
