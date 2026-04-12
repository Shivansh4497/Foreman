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

    const { data: secretData, error: secretErr } = await supabase.rpc('get_service_secret', {
      secret_id: llmConfig.vault_secret_id
    });

    if (secretErr || !secretData) {
      logger.error("Failed to decrypt API key from Vault", { errorMessage: secretErr?.message });
      await failRun(payload.run_id, "Failed to unlock provider API key via Vault");
      return;
    }
    const apiKey = secretData;

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

    // Initialize/resume Notepad State
    const globalState = run.global_state || {};
    const stepStatuses = globalState.step_statuses || {};
    let currentStepNumber = globalState.current_step || 1;

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

      const systemPrompt = `You are an automated step executor within the Foreman workforce architecture.
You must perfectly execute the following step based strictly on the provided instructions.
Enforce the QUALITY RULES. Ensure your output conforms precisely to the OUTPUT FORMAT.

AGENT MEMORY:
${run.agents.agent_memory || "No specific memory learned yet."}

CURRENT NOTEPAD STATE (Outputs from previous steps):
${JSON.stringify(globalState, null, 2)}

STEP DEFINITION:
OBJECTIVE: ${step.objective}
INPUTS: ${step.inputs}
OUTPUT FORMAT: ${step.output_format}
QUALITY RULES: ${step.quality_rules}

Perform the objective now. Output ONLY what is requested in the OUT FORMAT. Do not include conversational filler or markdown wrappers unless explicitly requested.`;

      try {
        const output = await callLLM({
          provider: llmConfig.provider,
          model: llmConfig.model,
          apiKey: apiKey,
          systemPrompt: systemPrompt,
          userTurn: `EXECUTE STEP ${step.step_number}: ${step.objective}`,
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
