# Build Plan — Feature 7: Agent Profile Panel
**Sprint opened:** 2026-04-13T11:12:19+05:30
**Architect:** @architect
**Status:** IN PROGRESS

---

## Blockers (resolve before building)
- **Memory Tab Data Structure:** `SOT/user_flows.md` specifies a two-column memory tab (Voice/Style vs. Topics/Context) with labels per item. However, `SOT/product_prd.md` (v1 implementation) specifies simply a "text blob permanent memory" stored in `agents.agent_memory`, which may not cleanly parse into distinct categories. Action: Until episodic memory (v1.5) is built, @builder must render the `agents.agent_memory` text blob directly in the Memory tab, bypassing the complex categorical design unless the blob strictly conforms to a structured JSON format.
- **Provider Settings per Agent:** `SOT/design.md` and user flows mention a "Provider" selection in the agent profile Workflow tab. However, Feature 1 states the provider is a global BYOK user setting. Action: @builder must display the globally configured provider as read-only on the agent level to prevent conflicts with global BYOK logic, unless a new agent-specific configuration column is intended but missing from the schema.
- **Conversation Page location:** The trigger is located in the conversation header. The codebase uses `src/app/dashboard/run/[id]/page.tsx` for runs, but standard Agent Conversation (Feature 10) may use an `agent/[id]` layout. Action: @builder must inject the profile panel overlay into the active conversation container (likely expanding on the existing `run/[id]` page representation or creating a dedicated client container).

---

## Step 1 — Backend / Database
> Backend must be verified by human before Step 2 begins.

- [ ] 1.1 **Create `GET /api/agents/[id]/profile` route:** Fetches `agents` row, `agent_steps` rows (ordered by `step_number`), and `agent_runs` rows (ordered by `created_at` desc) for the active agent. Also calculates `total_runs`, `total_cost`, `total_time_saved`, `avg_run_time` based on run records, bypassing the need for frontend duplication of these aggregations. → @builder (backend)
- [ ] 1.2 **Create `PATCH /api/agents/[id]/config` route:** Accepts `{ schedule, output_format }` and safely updates the `agents` table. Note: Actual Trigger.dev cron rescheduling is out of scope for this sprint. @builder should ONLY update the schedule text field in the database and skip the Trigger.dev part. → @builder (backend)
- [ ] 1.3 **Verify/Update `PATCH /api/scout/step`:** Ensure the existing step editing endpoint supports toggling `step_type` (Automated ↔ Manual Review). Update `agent_steps.step_type` dynamically for future runs. → @builder (backend)
- [ ] 1.4 **Human verifies:** Request `GET /api/agents/[id]/profile` and `PATCH /api/agents/[id]/config` directly using curl or Postman; verify responses align with Supabase DB state. → human

---

## Step 2 — Frontend / UI
> Do not begin until Step 1 human verification is complete.

- [ ] 2.1 **Create `ProfilePanel.tsx` component:** Full-screen overlay component (covering the main area but preserving the sidebar) per S26/S27/S28 specs. Must mount the Hero section displaying Agent Avatar, Name, Status, Stats Bar (4 columns), and action buttons. → @builder (frontend)
- [ ] 2.2 **Create `ProfileMemoryTab.tsx` component:** Mount read-only view of the `agents.agent_memory` payload. → @builder (frontend)
- [ ] 2.3 **Create `ProfileWorkflowTab.tsx` component:** Mount the step list leveraging `agent_steps`. Display the Step type toggle (Automated ↔ Manual Review) inline or pass to `StepEditModal.tsx`. Include config blocks below the list for Schedule, Provider, and Output format. Reuse `StepEditModal.tsx` for actual metadata edits. → @builder (frontend)
- [ ] 2.4 **Create `ProfileHistoryTab.tsx` component:** Mount a table/list view of past agent runs leveraging `agent_runs` records (Date, run number, status dot, duration, cost). → @builder (frontend)
- [ ] 2.5 **Mount Panel into Conversation Header & Dashboard:** Connect the panel visibility state to the agent name/avatar click trigger in both the dashboard agent cards and the run view (`src/app/dashboard/run/[id]/page.tsx`). The Profile Panel component must be accessible from both places. → @builder (frontend)
- [ ] 2.6 **Human verifies:** Launch `/dashboard/run/[id]`, click the header avatar, navigate through all three tabs, click "Edit" on a workflow step to spawn the modal, issue a save, and finally close the profile securely back to the conversation. → human

---

## Step 3 — Integration Check
- [ ] 3.1 **Verify Mutations:** Confirm that editing a step type and changing a schedule from the UI cleanly invoke their respective `PATCH` requests and update the DB without silent failures. → @builder (frontend)
- [ ] 3.2 **Human end-to-end test:** Open an agent profile, edit a step, change its type to `Manual Review`, launch a new "Run now" job for the agent, and confirm the system actually halts at the newly configured checkpoint. → human

---

## Definition of Done
A user clicks the agent's name/avatar within the dashboard or conversation header to spawn a full-screen profile overlay. The user seamlessly browses the Memory, Run History, and Workflow tabs. The user successfully modifies a step instruction, flips its status between Automated/Manual, and returns to the active conversation securely without page unmounting issues or context loss.
