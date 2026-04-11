# Foreman — User Flows

**Version:** 1.0.0
**Format:** Trigger → Validate → Mutate → Result

All flows follow this exact pattern as required by the Antigravity SOP.
Every flow maps to a feature in SOT/product_prd.md.

---

## Flow 1 — Authentication & BYOK Setup

**Feature:** Feature 1
**Entry point:** Landing page
**Happy path:** User signs in, sets up API key, lands on dashboard

---

### Flow 1.1 — New user sign-in

**Trigger:** User clicks "Sign in with Google" on landing page

**Validate:**

- Google OAuth token is valid
- Email is not already registered (new user path)

**Mutate:**

- Supabase creates user record (`users` table)
- Session cookie set

**Result:** User redirected to onboarding screen (provider selection)

---

### Flow 1.2 — Returning user sign-in

**Trigger:** User clicks "Sign in with Google" on landing page

**Validate:**

- Google OAuth token is valid
- Email exists in `users` table

**Mutate:**

- Session refreshed

**Result:** User redirected to dashboard

---

### Flow 1.3 — BYOK API key setup (onboarding)

**Trigger:** User selects LLM provider, enters API key, clicks "Save"

**Validate:**

- Provider selection is one of: OpenAI, Anthropic, Gemini, Groq
- API key field is not empty
- API key passes format validation for selected provider

**Mutate:**

- API key encrypted and stored in Supabase Vault
- Reference UUID stored in `user_llm_config` table
- Plaintext key immediately discarded — never written to any column

**Result:** User redirected to empty dashboard with success message

---

### Flow 1.4 — Update API key (Settings)

**Trigger:** User navigates to Settings → API Key tab, enters new key, clicks "Update"

**Validate:**

- User is authenticated
- New API key field is not empty
- New key passes format validation

**Mutate:**

- Old Vault secret deleted
- New API key encrypted and stored in Supabase Vault
- `user_llm_config` reference UUID updated

**Result:** Success message shown. New key active immediately on next agent run.

---

## Flow 2 — Scout: Agent Creation via Conversation

**Feature:** Feature 2
**Entry point:** Dashboard → "Hire new agent" button
**Happy path:** User describes task → Scout asks minimum questions → Blueprint builds live → User hires agent

---

### Flow 2.1 — Open Create Agent page

**Trigger:** User clicks "Hire new agent" on dashboard

**Validate:**

- User is authenticated
- User has valid API key stored (if not → redirect to Settings with prompt)

**Mutate:**

- New draft agent record created in `agents` table with status `draft`
- Empty conversation started in `conversations` table

**Result:** Create Agent page loads. Scout chat on left, empty Workforce Blueprint on right. Scout displays opening message: "What should this agent do?"

---

### Flow 2.2 — Scout conversation turn

**Trigger:** User sends a message in Scout chat

**Validate:**

- Message is not empty
- Draft agent record exists for this session

**Mutate:**

- Message appended to conversation history
- Scout runs Layer 1–5 pipeline:
  1. Intent classified into task category
  2. Missing context identified — minimum questions determined
  3. Workflow template selected for category
  4. User's stored context map injected into step instructions
  5. Every step validated against quality rubric before display
- Blueprint JSON updated in `agents` table (draft)
- Scout response appended to conversation history

**Result:**

- Scout response appears in chat (question, clarification, or confirmation)
- Workforce Blueprint re-renders on right panel in real time
- All step instructions visible with OBJECTIVE / INPUTS / OUTPUT FORMAT / QUALITY RULES / FAILURE CONDITIONS

---

### Flow 2.3 — User edits a step manually

**Trigger:** User clicks edit icon on a step in the Workforce Blueprint

**Validate:**

- Step belongs to current draft agent
- User is authenticated

**Mutate:**

- Edit modal opens with step's full instructions
- User saves changes → step instructions updated in `agents` table (draft)

**Result:** Blueprint re-renders with updated step. Scout is not re-invoked.

---

### Flow 2.4 — User proceeds to Review & Hire

**Trigger:** User clicks "Review & Hire" CTA

**Validate:**

- Blueprint has at least 1 step
- Agent has a name
- All steps pass format validation (OBJECTIVE, INPUTS, OUTPUT FORMAT, QUALITY RULES, FAILURE CONDITIONS all present)

**Mutate:**

- None — read-only review screen

**Result:** Review & Hire page loads. Full step list displayed. Each step expandable. "Hire Agent" CTA visible.

---

### Flow 2.5 — User hires agent

**Trigger:** User clicks "Hire Agent" on Review & Hire page

**Validate:**

- All steps are valid
- Agent has a name and schedule set
- User is authenticated

**Mutate:**

- Agent record status updated from `draft` to `active` in `agents` table
- Schedule registered with Trigger.dev if scheduled run selected
- Initial agent memory record created in `agent_memory` table (empty, ready for first run)

**Result:** User redirected to dashboard. New agent card visible with status "Active". Success message shown.

---

## Flow 3 — Agent Execution & Real-Time Progress

**Feature:** Feature 4
**Entry point:** Dashboard → agent card → "Run Now", or scheduled trigger fires
**Happy path:** All steps execute, checkpoint is hit, user approves, run completes

---

### Flow 3.1 — Manual run triggered

**Trigger:** User clicks "Run Now" on agent card

**Validate:**

- Agent status is "Active" (not Paused, Running, or Failed)
- User has valid API key
- No other run is currently active for this agent

**Mutate:**

- New run record created in `agent_runs` table with status `running`
- Agent status updated to `Running` on dashboard
- Trigger.dev job enqueued with agent ID and run ID

**Result:** Run view opens. "Step 1 of N — [step name]..." displayed with spinner. Browser can now be closed — run continues server-side.

---

### Flow 3.2 — Scheduled run fires

**Trigger:** Trigger.dev cron fires for agent at scheduled time

**Validate:**

- Agent status is "Active"
- User has valid API key
- No other run is currently active for this agent

**Mutate:**

- New run record created in `agent_runs` table with status `running`
- Agent status updated to `Running`
- Trigger.dev job begins

**Result:** Run executes server-side. User sees status change on dashboard if they are online.

---

### Flow 3.3 — Step execution

**Trigger:** Trigger.dev executes a step in the workflow

**Validate:**

- Run record status is `running`
- Global state notepad contains all required inputs for this step

**Mutate:**

- API key decrypted via Supabase Vault RPC (`get_service_secret`) — plaintext exists only in memory for duration of this function
- LLM called with: step instructions + global state notepad + agent memory
- Step output written to global JSON state notepad in `agent_runs` table
- Run record updated: current step, tokens used (input + output separately), timestamp
- Cost calculated: `(input_tokens × input_rate) + (output_tokens × output_rate)` using provider pricing dictionary
- Cumulative cost updated on run record

**Result:** Frontend polling detects step completion. Step shows green checkmark. "Passed output to next step" indicator appears. Next step spinner activates.

---

### Flow 3.4 — Step failure

**Trigger:** LLM call fails or step output fails quality validation

**Validate:** N/A

**Mutate:**

- Run record status updated to `failed`
- Failure details written to run record (which step, what error, in plain English)
- Agent status updated to `Failed`

**Result:** Frontend shows failure message in plain English. "What failed: [step name] — [reason]". Retry button offered.

---

### Flow 3.5 — Checkpoint reached

**Trigger:** Trigger.dev reaches a step marked MANUAL REVIEW

**Validate:**

- Run record status is `running`
- Step is correctly marked as checkpoint type

**Mutate:**

- Run record status updated to `waiting_for_human`
- Checkpoint record created in `checkpoints` table with step output, run ID, step ID
- If scheduled run: email sent via Resend with link to checkpoint review

**Result:** Frontend polling detects `waiting_for_human`. Checkpoint UI renders: step output displayed, quick reply buttons shown, free text input and Approve button visible.

---

### Flow 3.6 — User approves checkpoint

**Trigger:** User clicks quick reply or types feedback and clicks "Approve"

**Validate:**

- Checkpoint record exists and status is `pending`
- Run record status is `waiting_for_human`

**Mutate:**

- Human input written to global state notepad
- Checkpoint record status updated to `approved`
- Run record status updated back to `running`
- Trigger.dev job resumed from next step

**Result:** Checkpoint UI dismissed. Next step spinner activates. Run continues.

---

### Flow 3.7 — Run completes successfully

**Trigger:** Final step executes and passes

**Validate:**

- All steps are marked complete
- No steps failed

**Mutate:**

- Run record status updated to `complete`
- Agent status updated to `Active`
- Final output stored on run record
- Time saved calculated and added to agent cumulative metrics
- Token cost finalised and added to agent cumulative cost

**Result:** Final output displayed to user. Approve / Reject buttons shown.

---

## Flow 4 — Agent Memory & Instruction Updates

**Feature:** Feature 5
**Entry point:** Post-run output screen
**Happy path:** User gives feedback → Scout updates agent memory → next run is smarter

---

### Flow 4.1 — User approves final output

**Trigger:** User clicks "Approve" on final run output

**Validate:**

- Run record status is `complete`
- User is authenticated

**Mutate:**

- Run outputs (key facts, generated content summaries) appended to `agent_memory` table
- "Memory updated" indicator written to run record

**Result:** Success message shown. Agent memory now contains this run's outputs. Next run will reference them automatically.

---

### Flow 4.2 — User rejects final output

**Trigger:** User clicks "Reject" on final run output

**Validate:**

- Run record status is `complete`
- User is authenticated

**Mutate:**

- Scout activated with: rejected output + request for feedback

**Result:** Scout asks "What wasn't right about this run?" in plain English.

---

### Flow 4.3 — User provides rejection feedback

**Trigger:** User types feedback and submits

**Validate:**

- Feedback is not empty
- Agent record exists

**Mutate:**

- Scout rewrites relevant section of agent's permanent instructions in `agent_memory` table
- "Memory updated" indicator shown: lists exactly what changed
- New run enqueued immediately (fresh from Step 1)

**Result:** Memory updated indicator displayed. Fresh run begins automatically with updated instructions.

---

## Flow 5 — Cost & Value Dashboard

**Feature:** Feature 6
**Entry point:** Settings → Usage tab, or agent card metrics

---

### Flow 5.1 — View usage dashboard

**Trigger:** User navigates to Settings → Usage tab

**Validate:**

- User is authenticated

**Mutate:** None — read only

**Result:** Dashboard displays:

- Total tokens used today (input + output separately)
- Total cost today ($)
- Total cost this month ($)
- Per-agent breakdown: runs, tokens, cost, time saved
- "Your agents have saved you X hours this month" headline metric

---

### Flow 5.2 — Conversion trigger fires

**Trigger:** User's cumulative time saved crosses 10 hours

**Validate:**

- User is on Free plan
- Time saved metric crosses threshold

**Mutate:**

- Conversion prompt flagged to display on next dashboard load

**Result:** Dashboard shows: "Your agents have saved you 10+ hours this month. You're on the free plan. Unlock more."

---

## Flow 6 — Agent Scheduling

**Feature:** Feature 7
**Entry point:** Agent creation (Review & Hire) or Agent Edit page

---

### Flow 6.1 — Set schedule on hire

**Trigger:** User selects schedule during agent creation

**Validate:**

- Schedule selection is valid (Manual / Daily / Weekly / Monthly / Custom)
- If Custom: day and time are both specified

**Mutate:**

- Schedule stored on `agents` record
- Trigger.dev cron registered for agent ID at specified schedule

**Result:** Agent hired with schedule active. Next scheduled run shown on agent card.

---

### Flow 6.2 — Scheduled run hits checkpoint

**Trigger:** Scheduled run reaches a MANUAL REVIEW step

**Validate:**

- Run is a scheduled (not manual) run
- User has email on record

**Mutate:**

- Run paused at checkpoint (same as Flow 3.5)
- Email sent via Resend: "Your agent [name] needs your approval. [Link to review]"

**Result:** User receives email, clicks link, lands on checkpoint review screen. Flow continues as Flow 3.6.

---

## Flow 7 — Agent Editing Post-Hire

**Feature:** Feature 8
**Entry point:** Dashboard → agent card → "Edit"

---

### Flow 7.1 — Edit agent

**Trigger:** User clicks "Edit" on agent card

**Validate:**

- Agent status is not `Running` (cannot edit a running agent)
- User is authenticated

**Mutate:** None on open — read mode

**Result:** Agent detail page opens in edit mode. All fields editable.

---

### Flow 7.2 — Save agent edits

**Trigger:** User makes changes and clicks "Save"

**Validate:**

- Changed fields pass format validation
- At least one step remains in the workflow

**Mutate:**

- Agent record updated in `agents` table
- If schedule changed: old Trigger.dev cron cancelled, new cron registered
- If steps changed: step records updated in `agent_steps` table

**Result:** Success message. Agent card updated on dashboard with new settings.

---

# Foreman User Flows — Additions

**Append these flows to SOT/user_flows.md**

---

## Flow 8 — Agent Conversation

**Feature:** Feature 10
**Entry point:** Dashboard → agent card → agent name (opens conversation)
**Happy path:** User opens conversation, reads last run output, gives feedback, agent updates memory

---

### Flow 8.1 — Open agent conversation

**Trigger:** User clicks agent name or "View" on agent card from dashboard

**Validate:**

- Agent exists and belongs to user
- User is authenticated

**Mutate:** None — read only on open

**Result:** Agent conversation screen loads. Full message history visible. Most recent run thread at bottom. Input area active.

---

### Flow 8.2 — User sends message to agent

**Trigger:** User types message and hits send in conversation input

**Validate:**

- Message is not empty
- Agent record exists

**Mutate:**

- Message stored in `agent_conversations` table against agent ID and run ID (or null if between runs)
- Scout processes message to determine intent:
  - If feedback on output → update agent permanent memory
  - If instruction ("make it shorter", "focus on X") → update agent permanent memory
  - If trigger ("run now") → initiate manual run (Flow 3.1)
  - If question → agent responds conversationally
- Agent response stored in `agent_conversations` table

**Result:** Agent response appears in thread. If memory was updated, memory tag appears: "🧠 Memory updated — [what changed]"

---

### Flow 8.3 — Checkpoint appears inline in conversation

**Trigger:** Agent run reaches a MANUAL REVIEW step during a run initiated from conversation

**Validate:**

- Run status is `waiting_for_human`
- Conversation belongs to this agent

**Mutate:**

- Checkpoint rendered inline as a message in the conversation thread
- Run status: `waiting_for_human` (same as Flow 3.5)

**Result:** Checkpoint UI appears inline — options, quick replies, free text input, Send button. User does not navigate away from conversation.

---

### Flow 8.4 — User approves checkpoint from conversation

**Trigger:** User clicks quick reply or types feedback and clicks Send in inline checkpoint

**Validate:**

- Checkpoint is active for this run
- Input is not empty if free text path

**Mutate:**

- Same as Flow 3.6 — human input written to global state, run resumes
- Checkpoint UI replaced with "Continuing run..." message

**Result:** Run continues. Next step executes. Step outputs appear as messages when complete.

---

### Flow 8.5 — Checkpoint loop-back triggered

**Trigger:** User clicks "Search again" quick reply or types rejection feedback at checkpoint

**Validate:**

- Checkpoint is active
- Loop-back is appropriate for this step type (not all checkpoints support loop-back)

**Mutate:**

- Rejection content written to global state notepad
- Rejection stored as episodic memory record (v1.5) or appended to permanent memory (v1)
- Run loops back to designated upstream step (defined per agent type — e.g. Step 1 for topic generators)
- Upstream steps re-execute with rejection context injected
- Step sidebar: upstream step shows amber spinner, checkpoint step shows "Will return here"

**Result:** Loop-back indicator appears in conversation. Agent re-runs upstream steps. Returns to checkpoint with new options. Rejected options never appear again in this run or future runs.

---

## Flow 9 — Agent Profile Panel

**Feature:** Feature 11
**Entry point:** Agent conversation header → click agent name or avatar
**Happy path:** User opens profile, views memory, edits a workflow step, returns to conversation

---

### Flow 9.1 — Open agent profile

**Trigger:** User clicks agent name or avatar in conversation header

**Validate:**

- Agent belongs to user
- User is authenticated

**Mutate:** None — read only on open

**Result:** Profile panel opens full width over conversation area. Sidebar remains visible. Memory tab active by default. Hero shows agent name, status, stats bar, action buttons.

---

### Flow 9.2 — View memory tab

**Trigger:** Profile is open, Memory tab is active (default)

**Validate:** N/A

**Mutate:** None — read only

**Result:** Two-column layout showing:

- Left: Voice & style memories (preferences, confirmed feedback)
- Right: Topics & context (avoid list, what performs well, past outputs)

Each memory item shows type label and content text.

---

### Flow 9.3 — View workflow tab

**Trigger:** User clicks Workflow tab in profile

**Validate:** N/A

**Mutate:** None on view

**Result:** Full step list with Edit button on each step. Config section below showing schedule, provider, output format. Schedule has Change button.

---

### Flow 9.4 — Edit step from profile

**Trigger:** User clicks Edit on a step in the Workflow tab

**Validate:**

- Agent is not currently running (cannot edit a running agent's steps)
- Step belongs to this agent

**Mutate:** None on open — modal opens

**Result:** Edit step modal opens over blurred profile. Fields: Step name, Step type toggle (Automated / Manual Review), Objective, Output format.

---

### Flow 9.5 — Save step edit from profile

**Trigger:** User makes changes and clicks "Save changes" in modal

**Validate:**

- Step name is not empty
- At least one field has changed

**Mutate:**

- Step record updated in `agent_steps` table
- If step type changed: checkpoint records updated accordingly
- If schedule changed (via Change button): old Trigger.dev cron cancelled, new cron registered

**Result:** Modal closes. Step row updates in workflow tab with new name/type. Footer note confirmed: "Changes apply from the next run."

---

### Flow 9.6 — Return to conversation from profile

**Trigger:** User clicks "Back to conversation" or "Open conversation" button

**Validate:** N/A

**Mutate:** None

**Result:** Conversation view restored. Profile panel dismissed.

---

## Flow 10 — Checkpoint Loop-Back (detailed)

**Feature:** Feature 12
**Entry point:** Any checkpoint in any agent run or test run
**Happy path:** User rejects all options → agent loops back → returns with new options → user selects

---

### Flow 10.1 — User triggers loop-back

**Trigger:** User clicks "Search again" / loop-back quick reply at checkpoint, OR types rejection text that Scout classifies as a rejection

**Validate:**

- Checkpoint is active (`waiting_for_human` status)
- Loop-back is supported for this checkpoint's agent type

**Mutate:**

- Rejection reason written to global state: `{ "rejected_options": [...], "rejection_reason": "...", "loop_back_from": step_id }`
- Run status updated to `looping_back`
- Upstream step ID determined from agent config (e.g. Step 1 for content agents)
- Trigger.dev re-queues execution from upstream step

**Result:**

- Sidebar: upstream step shows amber spinner + "Retrying..."
- Checkpoint step shows "Will return here"
- Main area: looping-back indicator (amber banner) + "What you asked for" card echoing user's exact feedback
- Footer note: "Rejected topics stored in memory — won't appear again"

---

### Flow 10.2 — Upstream steps re-execute

**Trigger:** Trigger.dev picks up loop-back job from upstream step

**Validate:**

- Global state contains rejection context
- Agent memory contains updated avoid list

**Mutate:**

- Steps execute normally from upstream step
- Each step has rejection context in its global state — LLM instructed to avoid rejected options
- Rejection written to permanent agent memory (avoid list updated)

**Result:** Steps complete as normal. Outputs posted to global state.

---

### Flow 10.3 — Checkpoint reached again with new options

**Trigger:** Agent reaches the same checkpoint step again after loop-back

**Validate:**

- New options are genuinely different from rejected ones (quality check)

**Mutate:**

- Run status updated to `waiting_for_human` again
- New checkpoint rendered with fresh options

**Result:** Checkpoint UI reappears with new options. Loop-back indicator dismissed. User can select or loop back again.

---

## Error States — Additional

| Error                                       | User-facing message                                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Loop-back not supported for this checkpoint | "This checkpoint doesn't support searching again. Please pick one of the options or type your own topic." |
| Agent busy — cannot edit while running      | "This agent is currently running. You can edit its workflow once the run completes."                      |
| Memory update failed                        | "Your feedback was received but couldn't be saved to memory right now. It will apply to this run only."   |
| Profile could not load                      | "Couldn't load this agent's profile. Try refreshing the page."                                            |

## Error States (All Flows)

Every flow must handle these error states with plain English messages — no raw errors, no technical jargon:

| Error                      | User-facing message                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------- |
| API key invalid or expired | "Your API key didn't work. Please update it in Settings."                           |
| LLM provider rate limit    | "The AI provider is busy. Your run will retry automatically in 60 seconds."         |
| Step timeout               | "Step [name] took too long to complete. Please try running again."                  |
| No API key set             | "You haven't added an API key yet. Add one in Settings to run agents."              |
| Agent already running      | "This agent is already running. Wait for it to finish before starting another run." |
| Checkpoint email failed    | "We couldn't send the checkpoint email. Review it here instead."                    |

---

## Definition of Done Cross-Reference

| PRD Definition of Done step            | Flows that cover it           |
| -------------------------------------- | ----------------------------- |
| Sign in with Google                    | Flow 1.1                      |
| Enter API key                          | Flow 1.3                      |
| Tell Scout what the agent should do    | Flow 2.1, 2.2                 |
| Scout adapts to any task               | Flow 2.2 (Layer 1–5 pipeline) |
| See Workforce Blueprint live           | Flow 2.2                      |
| Hire the agent                         | Flow 2.5                      |
| Run manually                           | Flow 3.1                      |
| Hit a checkpoint, approve it           | Flow 3.5, 3.6                 |
| See final output delivered             | Flow 3.7                      |
| See cost and time saved                | Flow 5.1                      |
| Agent remembers everything on next run | Flow 4.1, 3.3                 |
