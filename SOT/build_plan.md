# Build Plan — Feature 5: Agent Memory
**Sprint opened:** 2026-04-13
**Architect:** @architect
**Status:** IN PROGRESS

---

## Blockers (resolve before building)
- None. (Graphify index was queried conceptually, but the SOT context is sufficient to proceed).

---

## Step 1 — Backend / Trigger.dev Auto-Memory Write
> Backend must be verified by human before Step 2 begins.

- [ ] 1.1 **Modify `src/trigger/runAgentWorkflow.ts` (Job Complete logic):** Inject an asynchronous LLM summarization call inside "4. Job Complete" (or immediately before updating the run to `completed`). The prompt must supply the `global_state` (step outputs/results) and instruct the LLM to generate a tight summary of "what worked" and "topics covered." → @builder
- [ ] 1.2 **Modify `src/trigger/runAgentWorkflow.ts` (Blob Operations):** Take the LLM summary from 1.1, and prepend it to the existing `agents.agent_memory` string. Use the literal memory entry format: 
`[YYYY-MM-DD] Run {run_id} Output: {Summary text}`. 
If the total prepended string exceeds 2000 characters, explicitly trim the oldest entries from the end of the blob. → @builder
- [ ] 1.3 **Modify `src/trigger/runAgentWorkflow.ts` (Database Write):** Update the `agents` table with the newly merged and trimmed `agent_memory` text synchronously prior to logging run completion. → @builder
- [ ] 1.4 **Human verifies:** Trigger a manual run. Wait for successful completion. Verify in the Supabase DB that the `agents.agent_memory` column is updated, properly prepended, and does not exceed 2000 characters. → human

---

## Step 2 — Backend / Checkpoint Feedback Capture
> Do not begin until Step 1 human verification is complete.

- [ ] 2.1 **Modify `src/trigger/runAgentWorkflow.ts` (Feedback Extraction):** At the beginning of `runAgentWorkflow`, or before fast-forwarding to the current step, inspect `global_state` for any new `step_{X}_human_feedback` elements that are present but haven't been committed to memory (track uncommitted feedback via a `processed_feedback` array stored in `global_state`). → @builder
- [ ] 2.2 **Modify `src/trigger/runAgentWorkflow.ts` (Feedback Processing):** For each piece of uncommitted human feedback, call the LLM to extract voice/tone signals or user requested adjustments. Prepend it to `agent_memory` safely up to the 2000 character limit using format: 
`[YYYY-MM-DD] Checkpoint Feedback ({step_X}): {Extracted signals}`. 
Write the updated memory blob to the `agents` table and mark feedback as processed in `global_state`. → @builder
- [ ] 2.3 **Human verifies:** Trigger a run containing a manual review checkpoint. Provide text feedback in the UI and click submit. Wait for run to process and proceed. Assert that the `agents.agent_memory` column immediately incorporates the textual feedback signals at the top of the 2000 character blob. → human

---

## Step 3 — Integration Check
- [ ] 3.1 **Human end-to-end test:** Hire a brand new agent. Provide qualitative feedback on "make it shorter" at a checkpoint. Let the run finish. Navigate to the agent's Profile Panel and confirm the "Memory" tab properly displays the pure text blob containing both the checkpoint feedback and the final run completion summary prepended accurately. → human

---

## Definition of Done
Agents automatically summarize successful run context and checkpoint feedback into a persistent, 2000-character-limited text blob stored on `agents.agent_memory`. This append-only write happens autonomously inside the Trigger.dev worker, capturing tone and topic signals to make the agent progressively smarter over successive runs. No new UI components or database structures are required.
