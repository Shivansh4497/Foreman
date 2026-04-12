# Build Plan — Feature 2: Scout Agent Creation via Conversation
**Sprint opened:** 2026-04-13T00:12:00+05:30
**Architect:** @architect
**Status:** COMPLETE

> **Note:** Sprint executed outside SOP — codebase ahead of plan. All phases marked as complete.

---

## Blockers (resolve before building)

- **S07–S09 HTML not rendered in screens.html.** The file ends after S06 with a comment: "Screens S07–S32 follow the same pattern." The Scout screen specs are defined in `SOT/design.md` (Scout Conversation Panel + Workforce Blueprint Panel sections) and in the product preview mockup embedded in S01's landing page. @builder must use `SOT/design.md` as the authoritative screen spec for S07–S09. No screen-level HTML exists for these in `screens.html`. If the builder needs wireframe detail beyond what design.md and the S01 preview provide, this must be escalated to human before building the frontend.
- **No ambiguity on pipeline.** All 5 Scout layers are fully specified in `SOT/product_prd.md` §"Scout's Architecture — How She Stays Extraordinary". Prompt templates must be authored by `@prompt_engineer` before `@builder` may begin Step 2 (Backend API) or any step containing LLM calls. This is a hard dependency.
- **`agents` table schema not yet defined.** Sprint 1 created `users` and `user_llm_config`. The `agents`, `agent_steps`, `conversations`, and `agent_memory` tables do not yet exist. All must be created in Step 1 before any other work begins.
- **`agent_drafts` is the working name during conversation.** Status column on `agents` table distinguishes `draft` from `active`. A separate `agent_drafts` table is NOT needed — drafts are rows in `agents` with `status = 'draft'`. User flows confirm this: Flow 2.1 creates a row in `agents` with `status: draft`.

---

## Step 1 — Backend / Database
> **BACKEND PHASE.** No LLM calls yet. No frontend work. Human must verify Step 1 is complete before Step 2 begins.

### 1.1 — Database: `agents` table → @builder

Create a new Supabase migration file at `supabase/migrations/YYYYMMDDXXXXXX_create_agents_table.sql`.

The `agents` table must have the following columns:
- `id` — uuid, primary key, default `gen_random_uuid()`
- `user_id` — uuid, not null, foreign key → `auth.users(id)` on delete cascade
- `name` — text, nullable (null until Scout proposes a name)
- `status` — text, not null, default `'draft'` — allowed values: `draft`, `active`, `paused`, `failed`
- `schedule` — text, nullable — stored as human-readable string (e.g. `'Every Monday at 9:00 AM'`, `'Manual only'`)
- `category` — text, nullable — the Layer 1 intent classification result (e.g. `'content_creation'`, `'research_analysis'`, `'monitoring'`, `'document_generation'`, `'data_processing'`, `'communication'`, `'custom'`)
- `blueprint_json` — jsonb, nullable — the full live blueprint object including steps array, schedule, output format, agent name
- `agent_memory` — text, nullable — the permanent text blob memory for this agent (v1 simple text blob, per PRD §Memory Architecture)
- `human_hours_per_run` — numeric, nullable — estimated human hours this task takes manually, set by Scout during creation
- `trigger_dev_schedule_id` — text, nullable — the Trigger.dev schedule ID registered for scheduled agents (populated on hire)
- `total_runs` — integer, not null, default 0
- `created_at` — timestamptz, not null, default `now()`
- `updated_at` — timestamptz, not null, default `now()`

### 1.2 — Database: `agent_steps` table → @builder

Create in the same migration file or a new migration file at `supabase/migrations/YYYYMMDDXXXXXX_create_agent_steps_table.sql`.

The `agent_steps` table must have the following columns:
- `id` — uuid, primary key, default `gen_random_uuid()`
- `agent_id` — uuid, not null, foreign key → `agents(id)` on delete cascade
- `user_id` — uuid, not null, foreign key → `auth.users(id)` on delete cascade
- `step_number` — integer, not null — ordering index (1-based)
- `name` — text, not null — human-readable step name (e.g. `'Find hot AI topics this week'`)
- `step_type` — text, not null — either `'automated'` or `'manual_review'`
- `objective` — text, not null — the OBJECTIVE field content
- `inputs` — text, not null — the INPUTS field content (must reference actual named sources, no placeholders)
- `output_format` — text, not null — the OUTPUT FORMAT field content (exact structure)
- `quality_rules` — text, not null — the QUALITY RULES field content (measurable standards only)
- `failure_conditions` — text, not null — the FAILURE CONDITIONS field content
- `loop_back_step_number` — integer, nullable — if this step is a checkpoint, the step number to loop back to on rejection (null for most steps)
- `created_at` — timestamptz, not null, default `now()`
- `updated_at` — timestamptz, not null, default `now()`

### 1.3 — Database: `conversations` table → @builder

Create a new migration file for the `conversations` table.

The `conversations` table must have the following columns:
- `id` — uuid, primary key, default `gen_random_uuid()`
- `agent_id` — uuid, not null, foreign key → `agents(id)` on delete cascade
- `user_id` — uuid, not null, foreign key → `auth.users(id)` on delete cascade
- `role` — text, not null — either `'scout'` or `'user'`
- `content` — text, not null — the raw message text
- `created_at` — timestamptz, not null, default `now()`

> **Note:** This table stores the Scout conversation history for a draft session. It is separate from `agent_conversations` (Feature 10, not in this sprint). Index on `(agent_id, created_at)` for chronological retrieval.

### 1.4 — Database: RLS policies → @builder

In the same or accompanying migration files, define Row Level Security policies:

For `agents`:
- Enable RLS on `agents`
- Policy: Authenticated users can SELECT, INSERT, UPDATE, DELETE only rows where `user_id = auth.uid()`

For `agent_steps`:
- Enable RLS on `agent_steps`
- Policy: Authenticated users can SELECT, INSERT, UPDATE, DELETE only rows where `user_id = auth.uid()`

For `conversations`:
- Enable RLS on `conversations`
- Policy: Authenticated users can SELECT, INSERT only rows where `user_id = auth.uid()`

### 1.5 — Human verification: Database → human

Before proceeding to Step 2, the human must verify all four of the following in the Supabase Table Editor and SQL editor:

1. `agents` table exists with all columns listed in 1.1. Confirm `status` default is `'draft'`. Confirm `blueprint_json` is nullable jsonb.
2. `agent_steps` table exists with all columns listed in 1.2. Confirm `step_type` is text (not an enum) and `loop_back_step_number` is nullable integer.
3. `conversations` table exists with all columns listed in 1.3. Confirm `role` column accepts `'scout'` and `'user'` values.
4. RLS is enabled on all three tables. Run a test query as a non-owner user and confirm it returns 0 rows (not an error, 0 rows).

---

## Step 2 — Prompt Engineering (LLM Pipeline)
> **@prompt_engineer must complete this step before @builder may write any API route that calls an LLM.**
> This step produces prompt templates only — no code files.

### 2.1 — Layer 1 prompt: Intent classification → @prompt_engineer

Write a system prompt for the intent classification call. This prompt must:
- Accept one input variable: `user_message` (the user's first message to Scout)
- Return a JSON object with exactly one key: `category`, whose value is one of: `content_creation`, `research_analysis`, `document_generation`, `data_processing`, `monitoring`, `communication`, `custom`
- Never return anything other than valid JSON
- Make the classification decision silently — no explanation in output

Save the prompt as a plain text file at: `src/lib/scout/prompts/layer1_intent_classification.txt`

### 2.2 — Layer 2 prompt: Minimum question bank → @prompt_engineer

Write a system prompt for the minimum question selection call. This prompt must:
- Accept input variables: `category` (from Layer 1), `user_message` (full message so far), `conversation_history` (array of prior messages), `user_context` (business description, target customer, 90-day goals, competitors — all from Supabase; inject actual values, never placeholders)
- Return a JSON object with exactly one key: `questions`, whose value is an array of strings — maximum 3 items
- The prompt must instruct Scout to skip any question already answered in `user_message` or `conversation_history`
- If all questions are already answered, `questions` must be an empty array `[]`

Save the prompt as: `src/lib/scout/prompts/layer2_question_bank.txt`

### 2.3 — Layer 3 prompt: Workflow template selection and customisation → @prompt_engineer

Write a system prompt for blueprint generation. This prompt must:
- Accept input variables: `category`, `user_message`, `conversation_history`, `user_context`, `clarifying_qa` (the Q&A pairs from the conversation so far)
- Contain the base workflow templates for all 7 categories hardcoded in the system prompt (content creation, research & analysis, document generation, data processing, monitoring, communication, custom)
- Instruct Scout to start from the correct template and customise step names, objectives, inputs, and outputs based on the user's specific task
- Return a JSON object with the following shape:
  ```
  {
    "agent_name": string,
    "schedule": string (human-readable, e.g. "Every Monday at 9:00 AM" or "Manual only"),
    "output_format": string,
    "category": string,
    "human_hours_per_run": number,
    "steps": [
      {
        "step_number": integer,
        "name": string,
        "step_type": "automated" | "manual_review",
        "objective": string,
        "inputs": string,
        "output_format": string,
        "quality_rules": string,
        "failure_conditions": string,
        "loop_back_step_number": integer | null
      }
    ]
  }
  ```
- Never return incomplete JSON. Never use placeholders. Inject actual user context values.

Save the prompt as: `src/lib/scout/prompts/layer3_blueprint_generation.txt`

### 2.4 — Layer 4: Context injection specification → @prompt_engineer

This is not a separate LLM call. It is a template substitution specification. Document the exact list of variables that must be queried from Supabase and injected into the Layer 3 prompt before it is sent to the LLM:

- `business_description` — from `users` table (if stored) or from conversation history
- `target_customer` — same source
- `goals_90_day` — same source
- `competitors` — same source
- `voice_tone` — from `agent_memory` on a prior agent of same category (if exists), else null

Document these substitution rules in: `src/lib/scout/prompts/layer4_context_injection_spec.md`

This file is documentation only — no code. It tells @builder exactly which Supabase queries to run before the LLM call and exactly which variables to substitute into the Layer 3 prompt.

### 2.5 — Layer 5 prompt: Quality gate validation → @prompt_engineer

Write a system prompt for the per-step quality validation call. This prompt must:
- Accept input variables: `step` (a single step JSON object containing name, step_type, objective, inputs, output_format, quality_rules, failure_conditions)
- Check all five criteria defined in PRD §Layer 5:
  1. OBJECTIVE clarity — specific measurable outcome, not vague
  2. INPUTS specificity — actual named data sources, no `[insert X]` placeholders
  3. OUTPUT FORMAT precision — exact structure specified
  4. QUALITY RULES measurability — standards are checkable, not subjective
  5. FAILURE CONDITIONS definition — states what a failed step looks like and what to do
- Return a JSON object: `{ "passes": boolean, "failures": string[] }` — `failures` is an array of which criteria failed (empty if all pass)
- If `passes` is false, Scout must regenerate the failing step and re-run the gate before returning the blueprint to the user

Save the prompt as: `src/lib/scout/prompts/layer5_quality_gate.txt`

### 2.6 — Scout reply generation prompt → @prompt_engineer

Write a system prompt for Scout's conversational reply generation. This is separate from the pipeline prompts. This prompt governs how Scout responds in the chat panel between blueprint iterations.

The prompt must enforce:
- Scout introduces itself once only on the first message with: "What should this agent do?"
- Scout never asks more than 3 clarifying questions before proposing a blueprint
- After 3 Q&A turns, Scout must propose the blueprint — no more questions
- Scout's tone: direct, confident, solutions-architect voice — never apologetic, never verbose
- When a blueprint exists, Scout confirms it in the right panel: "Blueprint's on the right — does this look right?"
- Scout never re-explains the same step it already proposed unless the user asks

Save as: `src/lib/scout/prompts/scout_conversation.txt`

### 2.7 — Human verification: Prompt review → human

Before @builder begins Step 3, the human must review all 5 prompt files and the context injection spec:
1. `layer1_intent_classification.txt` — confirm JSON-only output format is enforced
2. `layer2_question_bank.txt` — confirm max 3 questions and skip-if-answered logic is clear
3. `layer3_blueprint_generation.txt` — confirm all 7 category templates are present and output JSON shape matches the `agent_steps` schema exactly
4. `layer4_context_injection_spec.md` — confirm the variable list covers all context fields in user_context
5. `layer5_quality_gate.txt` — confirm all 5 validation criteria from PRD §Layer 5 are present
6. `scout_conversation.txt` — confirm Scout's 3-question limit and opening message are enforced

---

## Step 3 — Backend API Routes
> **Depends on Step 1 complete + Step 2 human-verified.** No frontend work begins until Step 3.5 human verification passes.

### 3.1 — `POST /api/scout/start` — Create draft agent → @builder

Create the file `src/app/api/scout/start/route.ts`.

This route:
1. Authenticates the user via Supabase server client (cookie-based, same pattern as Sprint 1)
2. Checks that the user has a valid API key in `user_llm_config` — if not, returns `400` with `{ error: 'no_api_key' }`
3. Inserts a new row into `agents` with `status = 'draft'`, `user_id`, `blueprint_json = null`
4. Inserts a new row into `conversations` with `role = 'scout'`, `content = 'What should this agent do?'` (Scout's opening message)
5. Returns `{ agent_id: uuid, opening_message: 'What should this agent do?' }`

### 3.2 — `POST /api/scout/message` — Send message to Scout and receive reply → @builder

Create the file `src/app/api/scout/message/route.ts`.

This route accepts: `{ agent_id: uuid, message: string }`.

This route must execute the full 5-layer Scout pipeline in this exact order:

1. **Auth check** — user is authenticated and owns the `agent_id` (query `agents` table, verify `user_id = auth.uid()`)
2. **Load conversation history** — query `conversations` where `agent_id` matches, ordered by `created_at` asc
3. **Store user message** — insert into `conversations` with `role = 'user'`, `content = message`
4. **Layer 1 — Intent classification** — call LLM with `layer1_intent_classification.txt` prompt and `user_message`. Store `category` result in a local variable. If `agents.category` is null, update it now.
5. **Layer 4 — Context injection** — query Supabase for user context fields per `layer4_context_injection_spec.md`. Build `user_context` object.
6. **Layer 2 — Question bank** — call LLM with `layer2_question_bank.txt` prompt. Receive `questions` array (0–3 items).
7. **Conversation turn count check** — if this is the 4th or later user message AND questions array is non-empty, override and force blueprint generation regardless. Scout must propose after max 3 clarifying rounds.
8. **Routing decision:**
   - If `questions` is non-empty AND turn count < 4: generate Scout's next question as the reply. Scout asks only the first question from the array (not all at once). Store Scout reply in `conversations`. Return `{ scout_message: string, blueprint_updated: false }`.
   - If `questions` is empty OR turn count ≥ 4: proceed to Layer 3.
9. **Layer 3 — Blueprint generation** — call LLM with `layer3_blueprint_generation.txt` prompt. Receive full blueprint JSON.
10. **Layer 5 — Quality gate** — for each step in the blueprint, call LLM with `layer5_quality_gate.txt`. If any step fails, call LLM again to regenerate that step with the failure reasons injected. Retry up to 2 times per step. If a step still fails after 2 retries, log the failure and use the best available version.
11. **Persist blueprint** — update `agents.blueprint_json` with the validated blueprint. Update `agents.name`, `agents.category`, `agents.schedule`, `agents.human_hours_per_run`.
12. **Upsert `agent_steps`** — delete existing rows for this `agent_id` and insert fresh rows from the validated blueprint steps. Each row maps exactly to the `agent_steps` schema from 1.2.
13. **Generate Scout reply** — call LLM with `scout_conversation.txt` prompt. Scout confirms the blueprint was updated and optionally asks one follow-up if something is unclear.
14. **Store Scout reply** — insert into `conversations`.
15. **Return** `{ scout_message: string, blueprint_updated: true, blueprint: blueprint_json }`.

> Note: The LLM call must use the user's own API key. Decrypt via `get_service_secret` RPC (same pattern as established in Sprint 1). The plaintext key must never leave the serverless function scope.

### 3.3 — `GET /api/scout/blueprint` — Fetch live blueprint → @builder

Create the file `src/app/api/scout/blueprint/route.ts`.

This route accepts: `?agent_id=uuid`.

It:
1. Authenticates the user and verifies ownership of the `agent_id`
2. Queries `agents` for `blueprint_json`, `name`, `schedule`, `category`
3. Queries `agent_steps` for all steps ordered by `step_number` asc
4. Returns: `{ agent: { name, schedule, category }, steps: agent_steps[] }`

### 3.4 — `PATCH /api/scout/step` — User manually edits a step → @builder

Create the file `src/app/api/scout/step/route.ts`.

This route accepts: `{ step_id: uuid, updates: { name?, step_type?, objective?, inputs?, output_format?, quality_rules?, failure_conditions? } }`.

It:
1. Authenticates the user and verifies the `step_id` belongs to a draft agent owned by this user (join `agent_steps` → `agents` and check `user_id`)
2. Updates only the provided fields in `agent_steps`
3. Updates `agents.updated_at`
4. Does NOT re-invoke Scout
5. Returns `{ success: true, step: updated_step_row }`

### 3.5 — `POST /api/scout/hire` — Hire the agent → @builder

Create the file `src/app/api/scout/hire/route.ts`.

This route accepts: `{ agent_id: uuid }`.

It:
1. Authenticates the user and verifies ownership
2. Validates: `agents.blueprint_json` is not null, `agents.name` is not null, `agents.schedule` is not null
3. Validates: `agent_steps` for this agent has at least 1 row AND every row has non-empty `objective`, `inputs`, `output_format`, `quality_rules`, `failure_conditions`
4. If any validation fails, returns `400` with a plain-English error message describing exactly what is missing
5. Updates `agents.status` from `'draft'` to `'active'`
6. Creates an initial row in `agent_memory` table... wait — `agent_memory` is stored as a text column on `agents.agent_memory`, not a separate table (per PRD §Memory Architecture v1). Set `agents.agent_memory = ''` (empty string, ready for first run)
7. Returns `{ success: true, agent_id: uuid }`

### 3.6 — Human verification: API routes → human

The human must verify all five API routes by making direct HTTP requests (e.g. using Postman or curl) against the local dev server (`npm run dev`):

1. `POST /api/scout/start` — Confirm it creates a new row in `agents` with `status = 'draft'`. Confirm `conversations` gets one row with `role = 'scout'` and `content = 'What should this agent do?'`
2. `POST /api/scout/message` with a first message — Confirm it returns a Scout clarifying question (not a blueprint yet). Confirm the message is stored in `conversations`.
3. `POST /api/scout/message` a 4th time without the questions being answered — Confirm it force-triggers blueprint generation and returns `blueprint_updated: true`.
4. `PATCH /api/scout/step` — Confirm a step field can be updated and the change persists in `agent_steps`. Confirm Scout is NOT called.
5. `POST /api/scout/hire` — Confirm `agents.status` changes to `'active'`. Confirm requesting with a draft that has no steps returns a `400` with a plain-English error.

---

## Step 4 — Frontend / UI
> **Do not begin until Step 3.6 human verification is complete.**

### 4.1 — Page: Create Agent (`/create`) → @builder

Create `src/app/create/page.tsx`.

This page must:
- Call `POST /api/scout/start` on mount (or via a server action when the route is first visited) to create the draft agent and get the `agent_id` and opening message. Store `agent_id` in component state.
- Use the exact layout from `SOT/design.md §Page Layouts — Scout Create Agent (no sidebar, full width split)`: `display: grid; grid-template-columns: 1fr 1fr; height: calc(100vh - topnav height);`
- Render a Top Navigation Bar (existing component from Sprint 1) with: Foreman logo left, "Review & Hire →" CTA button right (disabled until blueprint has at least 1 step)
- Left pane: Scout Conversation Panel (component 4.2)
- Right pane: Workforce Blueprint Panel (component 4.3)

Add a nav link to this page in the Dashboard (on the "Hire new agent" button — navigate to `/create`).

### 4.2 — Component: Scout Conversation Panel → @builder

Create `src/components/scout/ScoutChatPanel.tsx`.

Props: `agentId: string`.

This component must render:
1. **Panel header** — uppercase label "SCOUT — YOUR CHIEF OF STAFF" in `--text-tertiary`, `10px`, `600`, `0.4px letter-spacing`
2. **Message list** — scrollable, flex-column, `gap: 12px`, `padding: 16px`. Each message is a bubble:
   - Scout bubble: `background: #EEF2FB; border: 1px solid #C5D4F0;` — label "SCOUT" in `#2E5BBA` above bubble
   - User bubble: `background: #F0EEE9; border: 1px solid #D4CFC6;` — aligned right — label "YOU" in `#7A7770` above bubble
   - Scout typing indicator: three animated blue dots while awaiting Scout reply (spec in `SOT/design.md §Typing indicator`)
3. **Chat input area** — fixed to the bottom of the left pane. Uses the `.chat-input` style from `SOT/design.md §Chat input area`. Contains a textarea (single-line, expands on enter) and a Send button (dark fill, 28–30px, SVG arrow icon).
4. **Behaviour:** On send, append user message to list, show typing indicator, call `POST /api/scout/message`, receive Scout reply, remove typing indicator, append Scout reply. If `blueprint_updated: true` in response, call the `onBlueprintUpdated` callback (passed as a prop) with the new blueprint JSON.

### 4.3 — Component: Workforce Blueprint Panel → @builder

Create `src/components/scout/BlueprintPanel.tsx`.

Props: `agentId: string`, `blueprint: BlueprintJSON | null`.

This component must render:

**Empty state (blueprint is null):**
- Centered text in `--text-tertiary`: "Blueprint builds here as you chat with Scout."
- Background: `--bg` (`#F7F6F3`)

**Populated state:**
1. **Panel header row** — agent name (DM Serif Display, 16–18px, `--text-primary`) left, "LIVE" dot + label right (green pulsing dot, `font-size: 11px`, `color: #1A7A4A`, per `SOT/design.md §Live indicator`)
2. **Meta bubbles row** — 3 bubbles in a grid (1fr 1fr 1fr): Schedule, Output Format, Step count. Each bubble: `background: #F7F6F3; border: 1px solid #D4CFC6; border-radius: 8px; padding: 8px 10px;` with a `10px` uppercase label above and a `13px` value below. Per `SOT/design.md §Meta bubbles`.
3. **Steps list** — scrollable. Each step row per `SOT/design.md §Step row (blueprint)`:
   - Step number circle (22px) — AUTOMATED steps: `background: #F0EEE9; color: #7A7770`. MANUAL REVIEW steps: `background: #EEF2FB; color: #2E5BBA`
   - Step name (`13px`, `font-weight: 500`, `--text-primary`)
   - Tag badge — AUTOMATED: `background: #EAF5EE; color: #1A7A4A`. MANUAL REVIEW / checkpoint: `background: #FEF3DC; color: #8A5C00`
   - Edit button (small, 26px height, per `SOT/design.md §Small edit button`) — opens Step Edit Modal (4.4)
   - Checkpoint steps: `border-color: #C5D4F0` on the row
4. **Smooth re-render animation** — when blueprint updates (new Scout message arrives), the steps list must animate in with a subtle fade/slide. Duration: 200ms ease.

### 4.4 — Component: Step Edit Modal → @builder

Create `src/components/scout/StepEditModal.tsx`.

Props: `step: AgentStep`, `onSave: (updatedStep) => void`, `onClose: () => void`.

This modal renders over the blueprint panel. Follows `SOT/design.md §Modals` exactly:
- Overlay: `position: fixed; inset: 0; background: rgba(26,25,22,0.45); z-index: 100`
- Modal card: `background: #FFFFFF; border-radius: 14px; max-width: 480px; width: 100%; box-shadow: 0 8px 40px rgba(0,0,0,0.13)`
- **Header:** Step name + close button (×)
- **Body:** Five textarea fields, one for each step instruction section: OBJECTIVE, INPUTS, OUTPUT FORMAT, QUALITY RULES, FAILURE CONDITIONS. Each has a `12px 600` label above it.
- **Step type toggle:** Two pill buttons — "Automated" and "Manual Review". Active state: `background: #1A1916; color: #FFFFFF`. Inactive: outlined.
- **Footer:** "Cancel" (secondary button) and "Save changes" (primary button). On save, call `PATCH /api/scout/step` with the updated fields, then call `onSave` callback with the updated step.

### 4.5 — Page: Review & Hire (`/review`) → @builder

Create `src/app/review/page.tsx`.

This page receives `agentId` as a URL query param (`/review?agent_id=uuid`).

Layout: standard two-column with sidebar (identical to dashboard layout — sidebar on left, main content right).

Main content:
1. **Page heading** (DM Serif Display, 22–26px): "Review your agent"
2. **Subheading** (`13px`, `--text-secondary`): "Review every step before hiring. You can edit any step here."
3. **Agent metadata card** — shows: Agent name, Schedule, Category badge, Output format
4. **Full steps list** — every step expanded by default. Each step shown as a card with all five sections visible: OBJECTIVE, INPUTS, OUTPUT FORMAT, QUALITY RULES, FAILURE CONDITIONS. Edit button on each step opens the Step Edit Modal (4.4). Step type tag (AUTOMATED / MANUAL REVIEW) shown prominently.
5. **"Hire Agent" button** — primary dark button, width 100% or right-aligned. On click, calls `POST /api/scout/hire`. On success, redirect to `/dashboard`. On failure, display the plain-English error message returned by the API directly below the button.

### 4.6 — Dashboard: Wire up "Hire new agent" button → @builder

Modify `src/app/dashboard/page.tsx`.

The "Hire new agent" button and the "Hire your first agent" CTA in the empty state must navigate to `/create` using `next/navigation` (`router.push('/create')`). This is the only change to the dashboard file in this sprint.

### 4.7 — Human verification: UI → human

The human must verify the following on `localhost:3000`:

1. Navigate to `/dashboard` — confirm "Hire new agent" button navigates to `/create`
2. On `/create` — confirm the page loads with two equal-width panes. Confirm Scout's opening message "What should this agent do?" appears in the left chat pane. Confirm the right blueprint panel shows the empty state.
3. Send a first message to Scout — confirm the typing indicator appears and a Scout reply arrives. Confirm the user and Scout messages are bubbled correctly per design.
4. Send 3–4 more messages — confirm the blueprint panel populates with the agent name, meta bubbles (Schedule, Output, Steps count), and a list of steps with correct AUTOMATED/MANUAL REVIEW tags and badges.
5. Click Edit on any step — confirm the edit modal opens, all 5 fields are populated, changes can be saved, and the blueprint re-renders with the update.
6. Click "Review & Hire →" in the top nav — confirm it navigates to `/review?agent_id=...`. Confirm all steps are expanded with all 5 instruction sections visible.
7. Click "Hire Agent" on the review page — confirm redirect to `/dashboard` and the new agent card appears with status "Active".

---

## Step 5 — Integration Check

### 5.1 — Full flow walkthrough: LinkedIn Post Generator test case → @builder + human

This is the first of the four required test cases from PRD §The Four Test Cases.

Run this exact user flow to verify end-to-end correctness:

1. Navigate to `/create`
2. Type: "Weekly LinkedIn post generator. Find hot AI topics, no repeats, ask for my approval, write in my voice."
3. Scout should ask at most 2 clarifying questions (target audience or voice tone). Respond to them.
4. Blueprint panel must render a workflow with these minimum steps (in this order or equivalent):
   - Step: Research current hot AI topics (AUTOMATED)
   - Step: Check past posts for overlap (AUTOMATED)
   - Step: Generate topic/hook variations (AUTOMATED)
   - Step: You select topic and hook (MANUAL REVIEW — checkpoint)
   - Step: Draft post in your voice (AUTOMATED)
5. Verify all 5 step fields (OBJECTIVE, INPUTS, OUTPUT FORMAT, QUALITY RULES, FAILURE CONDITIONS) are non-empty and contain no `[insert X]` placeholders.
6. Proceed to Review & Hire. Confirm all steps are visible and editable.
7. Hire agent. Confirm agent card appears on `/dashboard` with status "Active".

→ @builder handles steps 1–5 end-to-end verification. Human verifies 6 and 7.

### 5.2 — Human end-to-end test: Full Sprint 2 user flow → human

The human must walk through the complete Flow 2 as defined in `SOT/user_flows.md`:

- Flow 2.1 ✓ (verified in 4.7 step 2)
- Flow 2.2 — Scout conversation turn — send multiple messages, verify blueprint updates after each blueprint-generating turn
- Flow 2.3 — Edit a step manually in the blueprint panel — verify Scout is NOT re-invoked
- Flow 2.4 — Navigate to Review & Hire — verify validation (blueprint has steps, agent has a name)
- Flow 2.5 — Hire agent — verify agent status changes to `active` in Supabase Table Editor

Confirm in Supabase Table Editor after hiring:
- `agents` row: `status = 'active'`, `blueprint_json` is populated, `name` is not null
- `agent_steps` has one row per step, all fields non-empty
- `conversations` has all turns logged in correct order with correct `role` values

---

## Definition of Done

A user opens `/create`, types what they want an agent to do in plain English, Scout asks at most 3 clarifying questions, the Workforce Blueprint panel builds live on the right with correctly structured steps (each step containing OBJECTIVE, INPUTS, OUTPUT FORMAT, QUALITY RULES, FAILURE CONDITIONS — no placeholders), the user clicks "Review & Hire", confirms the full step list, and clicks "Hire Agent" — the agent record appears on the dashboard with status "Active".

This matches **Flow 2.1 → 2.2 → 2.3 → 2.4 → 2.5** in `SOT/user_flows.md` exactly.

---

## Prompt Engineer Dependency Map

| Step | Depends on @prompt_engineer? | Which prompts |
|------|------------------------------|---------------|
| Step 1 (DB) | No | — |
| Step 2 | Yes — @prompt_engineer IS this step | All 6 prompts |
| Step 3.1 `/start` | No | — |
| Step 3.2 `/message` | **Yes** — cannot write LLM call logic until prompts are reviewed and approved | layer1–5 + scout_conversation |
| Step 3.3 `/blueprint` | No | — |
| Step 3.4 `/step` | No | — |
| Step 3.5 `/hire` | No | — |
| Step 4 Frontend | No (UI only) | — |

---

## File Map

### New files to create

| File | Type | Phase |
|------|------|-------|
| `supabase/migrations/YYYYMMDD_create_agents.sql` | Migration | Step 1.1 |
| `supabase/migrations/YYYYMMDD_create_agent_steps.sql` | Migration | Step 1.2 |
| `supabase/migrations/YYYYMMDD_create_conversations.sql` | Migration | Step 1.3 |
| `src/lib/scout/prompts/layer1_intent_classification.txt` | Prompt | Step 2.1 |
| `src/lib/scout/prompts/layer2_question_bank.txt` | Prompt | Step 2.2 |
| `src/lib/scout/prompts/layer3_blueprint_generation.txt` | Prompt | Step 2.3 |
| `src/lib/scout/prompts/layer4_context_injection_spec.md` | Spec doc | Step 2.4 |
| `src/lib/scout/prompts/layer5_quality_gate.txt` | Prompt | Step 2.5 |
| `src/lib/scout/prompts/scout_conversation.txt` | Prompt | Step 2.6 |
| `src/app/api/scout/start/route.ts` | API route | Step 3.1 |
| `src/app/api/scout/message/route.ts` | API route | Step 3.2 |
| `src/app/api/scout/blueprint/route.ts` | API route | Step 3.3 |
| `src/app/api/scout/step/route.ts` | API route | Step 3.4 |
| `src/app/api/scout/hire/route.ts` | API route | Step 3.5 |
| `src/app/create/page.tsx` | Page | Step 4.1 |
| `src/components/scout/ScoutChatPanel.tsx` | Component | Step 4.2 |
| `src/components/scout/BlueprintPanel.tsx` | Component | Step 4.3 |
| `src/components/scout/StepEditModal.tsx` | Component | Step 4.4 |
| `src/app/review/page.tsx` | Page | Step 4.5 |

### Files to modify

| File | Change | Phase |
|------|--------|-------|
| `src/app/dashboard/page.tsx` | Wire "Hire new agent" → `/create` | Step 4.6 |
| `SOT/log.md` | Append Sprint 2 log on closure | Sprint close |
| `SOT/product_prd.md` | Update completion % on closure | Sprint close |
