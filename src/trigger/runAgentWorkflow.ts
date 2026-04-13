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
      logger.error("Run not found or failed to fetch", { errorMessage: runErr?.message });
      throw new Error("Run not found");
    }

    const { data: llmConfig, error: configErr } = await supabase
      .from('user_llm_config')
      .select('provider, model, vault_secret_id')
      .eq('user_id', run.user_id)
      .single();

    if (configErr || !llmConfig) {
      logger.error("User LLM config not found or failed to fetch", { errorMessage: configErr?.message });
      await failRun(payload.run_id, "Missing LLM configuration for user");
      return;
    }

    const vaultSupabase = createClient(supabaseUrl, supabaseServiceKey, { db: { schema: 'vault' } });
    
    const { data: secretData, error: secretErr } = await vaultSupabase
      .from('decrypted_secrets')
      .select('decrypted_secret')
      .eq('id', llmConfig.vault_secret_id)
      .single();

    if (secretErr || !secretData || !secretData.decrypted_secret) {
      logger.error("Failed to decrypt API key from Vault", { errorMessage: secretErr?.message });
      await failRun(payload.run_id, "Failed to unlock provider API key via Vault");
      return;
    }
    const apiKey = secretData.decrypted_secret;

    // Initialize/resume Notepad State
    const globalState = run.global_state || {};
    const stepStatuses = globalState.step_statuses || {};
    let currentStepNumber = globalState.current_step || 1;

    // --- Step 2: Checkpoint Feedback Capture ---
    const processedFeedback = globalState.processed_feedback || [];
    let feedbackModified = false;

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
      await supabase
        .from('agent_runs')
        .update({ global_state: globalState })
        .eq('id', run.id);
    }
    // --- End Step 2 ---

    // 2. Load Agent Steps
    const { data: steps, error: stepsErr } = await supabase
      .from('agent_steps')
      .select('*')
      .eq('agent_id', run.agent_id)
      .order('step_number', { ascending: true });

    if (stepsErr || !steps || steps.length === 0) {
      logger.error("Steps not found", { errorMessage: stepsErr?.message });
      await failRun(payload.run_id, "Agent has no steps defined");
      return;
    }

    // Fast-forward to current step
    const targetSteps = steps.filter(s => s.step_number >= currentStepNumber);

    for (const step of targetSteps) {
      globalState.current_step = step.step_number;
      stepStatuses[step.step_number.toString()] = "running";
      
      // Persist that step has started
      await supabase
        .from('agent_runs')
        .update({ 
          status: 'running', 
          global_state: { ...globalState, step_statuses: stepStatuses } 
        })
        .eq('id', run.id);

      // Handle Component Types
      if (step.step_type === 'manual_review') {
        logger.info(`Suspending execution at Manual Review step (Step: ${step.step_number})`);
        
        // Let frontend polling know it's paused.
        stepStatuses[step.step_number.toString()] = "waiting_for_human";
        await supabase
          .from('agent_runs')
          .update({ 
            status: 'waiting_for_human',
            global_state: { ...globalState, step_statuses: stepStatuses } 
          })
          .eq('id', run.id);

        // Terminate trigger job safely. It will resume later as a new payload
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

      const systemPrompt = `You are an automated step executor within the Foreman workforce architecture.
You must perfectly execute the following step based strictly on the provided instructions.
Enforce the QUALITY RULES. Ensure your output conforms precisely to the OUTPUT FORMAT.
${run.agents.agent_memory ? `\nAgent memory from previous runs: ${run.agents.agent_memory}\n` : ""}
CURRENT NOTEPAD STATE (Outputs from previous steps):
${JSON.stringify(globalState, null, 2)}

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

        // Write output locally into global_state notepad
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

    // --- Step 1: Run Completion Summary ---
    try {
      logger.info("About to write memory summary");
      
      // Prune state to avoid context explosion/payload limits
      const summaryContext = Object.keys(globalState)
        .filter(k => k.endsWith('_output') || k.includes('_feedback'))
        .reduce((obj, key) => {
          obj[key] = globalState[key];
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
    // --- End Step 1 ---

    // 4. Job Complete
    await supabase
      .from('agent_runs')
      .update({
        status: 'completed',
        global_state: { ...globalState, step_statuses: stepStatuses, current_step: null },
        completed_at: new Date().toISOString()
      })
      .eq('id', run.id);

    // Increment Agent total_runs stat safely
    const { data: currentAgent } = await supabase.from('agents').select('total_runs').eq('id', run.agent_id).single();
    if (currentAgent) {
      await supabase.from('agents').update({ total_runs: (currentAgent.total_runs || 0) + 1 }).eq('id', run.agent_id);
    }

    logger.info(`Run successfully finished.`);
    return { success: true };
  }
});

// Helper Function
async function failRun(runId: string, errorReason: string) {
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
