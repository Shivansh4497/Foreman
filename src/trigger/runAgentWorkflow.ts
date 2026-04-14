import { task, logger } from "@trigger.dev/sdk/v3";
import { createClient } from "@supabase/supabase-js";
import { callLLM } from "../lib/llm";



export const runAgentWorkflow = task({
  id: "run-agent-workflow",
  maxDuration: 3600,
  run: async (payload: { run_id: string }) => {
    logger.info(`Starting agent workflow for run: ${payload.run_id}`);
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch Run and Agent metadata
    const { data: run, error: runErr } = await supabase
      .from('agent_runs')
      .select('*, agents(name, agent_memory)')
      .eq('id', payload.run_id)
      .single();

    if (runErr || !run) {
      logger.info("Run not found or failed to fetch", { errorMessage: runErr?.message });
      return; // Exit silently if run not found
    }

    // 1.1 Atomic Claim (Idempotency Guard)
    // Transition from 'pending' -> 'running' atomically.
    // If the run was already claimed (e.g. a duplicate Trigger.dev invocation),
    // the conditional update will find 0 rows and we exit safely.
    const { data: claimedRun, error: claimErr } = await supabase
      .from('agent_runs')
      .update({ status: 'running' })
      .eq('id', payload.run_id)
      .eq('status', 'pending')   // ← only succeeds if still pending
      .select()
      .single();

    if (claimErr || !claimedRun) {
      logger.warn(`Run ${payload.run_id} could not be claimed (current status: ${run.status}). Possible duplicate trigger — exiting safely.`);
      return;
    }
    
    logger.info(`Run ${payload.run_id} claimed successfully (run #${run.run_number}).`);

    const { data: llmConfig, error: configErr } = await supabase
      .from('user_llm_config')
      .select('provider, model, vault_secret_id')
      .eq('user_id', run.user_id)
      .single();

    if (configErr || !llmConfig) {
      logger.error("User LLM config not found or failed to fetch", { errorMessage: configErr?.message });
      await failRun(payload.run_id, "Missing LLM configuration for user", run.agent_id, run.user_id, run.run_number);
      return;
    }

    // 2. Unlock API Key via Vault RPC (Safe for Service Role)
    const { data: apiKey, error: rpcErr } = await supabase
      .rpc('get_service_secret', { secret_id: llmConfig.vault_secret_id });

    if (rpcErr || !apiKey) {
      logger.error("Failed to decrypt API key via Vault RPC", { errorMessage: rpcErr?.message });
      await failRun(payload.run_id, "Failed to unlock provider API key via Vault", run.agent_id, run.user_id, run.run_number);
      return;
    }
    logger.info("Secret retrieved successfully via RPC");

    // Initialize/resume Notepad State
    const globalState = run.global_state || {};
    const stepStatuses = globalState.step_statuses || {};
    let currentStepNumber = globalState.current_step || 1;

    // --- Checkpoint Feedback Capture ---
    const processedFeedback = globalState.processed_feedback || [];
    let feedbackModified = false;

    // Cancellation check before feedback processing
    if (await isCancelled(run.id, supabase)) {
      logger.info("Run cancelled, aborting feedback processing");
      return;
    }

    for (const key of Object.keys(globalState)) {
      if (key.match(/^step_\d+_human_feedback$/) && !processedFeedback.includes(key)) {
        const feedbackText = globalState[key];
        const stepNum = key.split('_')[1];
        
        try {
          logger.log("About to write memory");
          logger.log("Memory write - agentId", { agentId: run.agent_id, hasApiKey: !!apiKey });
          const signal = await callLLM({
            provider: llmConfig.provider,
            model: llmConfig.model,
            apiKey: apiKey,
            systemPrompt: "Extract the key preference or instruction from this user feedback in one sentence. Focus on tone, style, or content preferences. No preamble.",
            userTurn: `Feedback: ${feedbackText}`,
          });
          logger.log(`Memory LLM call result: success`);

          const date = new Date().toISOString().split('T')[0];
          await updateAgentMemory(run.agent_id, `[${date}] User feedback at step ${stepNum}: ${signal}`, supabase);
          
          processedFeedback.push(key);
          feedbackModified = true;
        } catch (err) {
          logger.log(`Memory LLM call result: error`);
          logger.error(`Failed to process feedback for ${key}`, { err });
          logger.error("Memory write failed", { error: err instanceof Error ? err.message : String(err) });
          // Skip silently as per requirements
        }
      }
    }

    if (feedbackModified) {
      globalState.processed_feedback = processedFeedback;
      // Only persist if not cancelled
      if (!(await isCancelled(run.id, supabase))) {
        await supabase
          .from('agent_runs')
          .update({ global_state: globalState })
          .eq('id', run.id)
          .eq('status', 'running');  // guard: skip if somehow cancelled between checks
      }
    }
    // --- End Feedback Capture ---

    // 3. Load Agent Steps
    const { data: steps, error: stepsErr } = await supabase
      .from('agent_steps')
      .select('*')
      .eq('agent_id', run.agent_id)
      .order('step_number', { ascending: true });

    if (stepsErr || !steps || steps.length === 0) {
      logger.error("Steps not found", { errorMessage: stepsErr?.message });
      await failRun(payload.run_id, "Agent has no steps defined", run.agent_id, run.user_id, run.run_number);
      return;
    }

    // Fast-forward to current step
    const targetSteps = steps.filter(s => s.step_number >= currentStepNumber);

    for (const step of targetSteps) {
      // Periodic cancellation check before each step
      if (await isCancelled(run.id, supabase)) {
        logger.info("Run cancelled by user, aborting execution loop");
        return;
      }

      globalState.current_step = step.step_number;
      stepStatuses[step.step_number.toString()] = "running";
      
      // Persist step-started state — conditioned on run still being active
      await supabase
        .from('agent_runs')
        .update({ 
          status: 'running', 
          global_state: { ...globalState, step_statuses: stepStatuses } 
        })
        .eq('id', run.id)
        .eq('status', 'running');  // guard: no-op if cancelled

      // Handle Manual Review steps
      if (step.step_type === 'manual_review') {
        logger.info(`Suspending execution at Manual Review step (Step: ${step.step_number})`);
        
        stepStatuses[step.step_number.toString()] = "waiting_for_human";
        await supabase
          .from('agent_runs')
          .update({ 
            status: 'waiting_for_human',
            global_state: { ...globalState, step_statuses: stepStatuses } 
          })
          .eq('id', run.id);

        logger.info("Task cleanly suspended awaiting human intervention.");
        return { message: "Suspended for manual review", step: step.step_number };
      }

      // Execute Automated LLM Step
      logger.info(`Executing step ${step.step_number}: ${step.objective}`);

      // Gather human feedback to inject
      let aggregatedFeedback = "";
      let feedbackFound = false;
      for (const key of Object.keys(globalState)) {
        if (key.match(/^step_\d+_human_feedback$/)) {
          aggregatedFeedback += `- ${globalState[key]}\n`;
          feedbackFound = true;
        }
      }

      logger.log(`Feedback found in global_state: ${feedbackFound ? 'yes' : 'no'}`);

      let feedbackInjection = "";
      let userFeedbackInjection = "";
      if (feedbackFound) {
        logger.log(`Injecting feedback into step ${step.step_number} prompt`);
        feedbackInjection = `\n\n========== CRITICAL USER FEEDBACK ==========\nThe human user has provided explicit feedback from a previous checkpoint:\n${aggregatedFeedback.trim()}\n============================================\nNOTE: You MUST modify your default behavior, output tone, or format to comply with this human feedback. This overrides any conflicting instructions or quality rules.\n`;
        
        userFeedbackInjection = `\n\nCRITICAL OVERRIDE: Do not forget to incorporate the human feedback:\n${aggregatedFeedback.trim()}`;
      }

      // Prepare a truncated notepad for the LLM to avoid 429 Rate Limits (TPM)
      const executionState = Object.keys(globalState).reduce((obj, key) => {
        const val = globalState[key];
        // Truncate previous step outputs to ~2000 chars to keep prompt stable under 6k TPM
        obj[key] = (typeof val === 'string' && val.length > 2000) 
          ? val.substring(0, 2000) + "... [content truncated for token limits]" 
          : val;
        return obj;
      }, {} as Record<string, any>);

      const systemPrompt = `You are an automated step executor within the Foreman workforce architecture.
You must perfectly execute the following step based strictly on the provided instructions.
Enforce the QUALITY RULES. Ensure your output conforms precisely to the OUTPUT FORMAT.
${run.agents.agent_memory ? `\nAgent memory from previous runs: ${run.agents.agent_memory}\n` : ""}
CURRENT NOTEPAD STATE (Outputs from previous steps):
${JSON.stringify(executionState, null, 2)}

STEP DEFINITION:
OBJECTIVE: ${step.objective}
INPUTS: ${step.inputs}
OUTPUT FORMAT: ${step.output_format}
QUALITY RULES: ${step.quality_rules}

Perform the objective now. Output ONLY what is requested in the OUT FORMAT. Do not include conversational filler or markdown wrappers unless explicitly requested.${feedbackInjection}`;

      try {
        const output = await callLLM({
          provider: llmConfig.provider,
          model: llmConfig.model,
          apiKey: apiKey,
          systemPrompt: systemPrompt,
          userTurn: `EXECUTE STEP ${step.step_number}: ${step.objective}${userFeedbackInjection}`,
        });

        globalState[`step_${step.step_number}_output`] = output;
        stepStatuses[step.step_number.toString()] = "completed";
      } catch (err) {
        logger.error(`Execution failed at step ${step.step_number}`, { err });
        stepStatuses[step.step_number.toString()] = "failed";
        await supabase
          .from('agent_runs')
          .update({ 
            status: 'failed',
            global_state: { ...globalState, step_statuses: stepStatuses } 
          })
          .eq('id', run.id);
        throw err;
      }
    }

    // --- Run Completion Summary (memory) ---
    try {
      if (await isCancelled(run.id, supabase)) return;
      logger.info("About to write memory summary");
      
      const summaryContext = Object.keys(globalState)
        .filter(k => k.endsWith('_output') || k.includes('_feedback'))
        .reduce((obj, key) => {
          const val = globalState[key];
          obj[key] = (typeof val === 'string' && val.length > 300) 
            ? val.substring(0, 300) + "... [truncated]" 
            : val;
          return obj;
        }, {} as Record<string, any>);

      const summary = await callLLM({
        provider: llmConfig.provider,
        model: llmConfig.model,
        apiKey: apiKey,
        systemPrompt: "Summarize what this agent run produced in 2-3 sentences. Focus on: what topics were covered, what the output was, any patterns worth remembering for future runs. Be specific and concise. No preamble.",
        userTurn: `Pruned Run Context (Outputs and Feedback): ${JSON.stringify(summaryContext)}`,
      });
      logger.info(`Memory LLM call result: success`);

      const date = new Date().toISOString().split('T')[0];
      await updateAgentMemory(run.agent_id, `[${date}] Run completed: ${summary}`, supabase);
    } catch (err) {
      logger.error("Failed to generate run completion summary", { err: err instanceof Error ? err.message : String(err) });
    }
    // --- End Completion Summary ---

    // 4. Final cancellation check before marking complete
    if (await isCancelled(run.id, supabase)) return;

    await supabase
      .from('agent_runs')
      .update({
        status: 'completed',
        global_state: { ...globalState, step_statuses: stepStatuses, current_step: null },
        completed_at: new Date().toISOString()
      })
      .eq('id', run.id)
      .eq('status', 'running');  // guard: no-op if cancelled between last check and now

    // Increment Agent total_runs stat safely
    const { data: currentAgent } = await supabase.from('agents').select('total_runs').eq('id', run.agent_id).single();
    if (currentAgent) {
      await supabase.from('agents').update({ total_runs: (currentAgent.total_runs || 0) + 1 }).eq('id', run.agent_id);
    }

    // Post run_card to agent_conversations
    try {
      const lastStepNumber = steps[steps.length - 1].step_number;
      const finalOutput = globalState[`step_${lastStepNumber}_output`] || '';
      
      const stepsArray = steps.map(s => ({
        step_number: s.step_number,
        name: s.name || s.objective.split('.')[0],
        step_type: s.step_type,
        status: stepStatuses[s.step_number.toString()] || 'completed',
        output: globalState[`step_${s.step_number}_output`] || null
      }));

      const durationSeconds = Math.floor(
        (Date.now() - new Date(run.created_at).getTime()) / 1000
      );

      // Use run.run_number from the DB — authoritative, set at insert time by trigger
      const { error: insertErr } = await supabase.from('agent_conversations').insert({
        agent_id: run.agent_id,
        user_id: run.user_id,
        run_id: run.id,
        role: 'agent',
        message_type: 'run_card',
        content: String(finalOutput).substring(0, 120) + (String(finalOutput).length > 120 ? '...' : ''),
        metadata: {
          run_number: run.run_number,  // ← DB-authoritative, not a live count()
          status: 'completed',
          step_count: steps.length,
          duration_seconds: durationSeconds,
          output_preview: String(finalOutput).substring(0, 120),
          full_output: finalOutput,
          steps: stepsArray
        }
      });
      
      if (insertErr) {
        logger.error("Failed to post run_card info", { 
          error: insertErr.message, 
          details: insertErr.details, 
          hint: insertErr.hint 
        });
      } else {
        logger.info("Successfully posted run_card to agent_conversations");
      }
    } catch (err: any) {
      logger.error("Exception in run_card posting logic", { error: err.message });
    }

    logger.info(`Run ${payload.run_id} successfully finished (#${run.run_number}).`);
    return { success: true };
  }
});

// Helper Function
async function failRun(runId: string, errorReason: string, agentId: string, userId: string, runNumber: number) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  await supabase
    .from('agent_runs')
    .update({ 
      status: 'failed', 
      global_state: { error: errorReason }
    })
    .eq('id', runId);

  // Insert failed run_card
  try {
    const { error: insertErr } = await supabase.from('agent_conversations').insert({
      agent_id: agentId,
      user_id: userId,
      run_id: runId,
      role: 'agent',
      message_type: 'run_card',
      content: errorReason,
      metadata: { 
        status: 'failed', 
        error: errorReason, 
        run_number: runNumber,  // ← passed in from caller, not a live count()
        step_count: 0 
      }
    });

    if (insertErr) {
      logger.error("Failed to post failure run_card", { 
        error: insertErr.message, 
        details: insertErr.details, 
        hint: insertErr.hint 
      });
    } else {
      logger.info("Successfully posted failure run_card to agent_conversations");
    }
  } catch (err: any) {
    logger.error("Exception in failure run_card posting logic", { error: err.message });
  }
}

async function updateAgentMemory(agentId: string, entry: string, supabase: any) {
  logger.info("Memory write starting", { agentId });
  try {
    const { data: agent, error: fetchErr } = await supabase.from('agents').select('agent_memory').eq('id', agentId).single();
    if (fetchErr) {
      logger.error("Failed to fetch current memory during update", { fetchErr });
      return;
    }

    let currentMemory = agent?.agent_memory || "";
    let newMemory = `${entry}\n${currentMemory}`;
    if (newMemory.length > 2000) {
      newMemory = newMemory.substring(0, 2000);
    }

    const { error: updateErr } = await supabase.from('agents').update({ agent_memory: newMemory }).eq('id', agentId);
    
    if (updateErr) {
      logger.error(`Supabase memory update result: error`, { updateErr });
    } else {
      logger.info(`Supabase memory update result: success`);
    }
  } catch (err) {
    logger.error("Failed to update agent memory (catch block)", { err: err instanceof Error ? err.message : String(err) });
  }
}

async function isCancelled(runId: string, supabase: any) {
  const { data } = await supabase
    .from('agent_runs')
    .select('status')
    .eq('id', runId)
    .single();
  return data?.status === 'cancelled';
}
