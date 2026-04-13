# Foreman — Product Requirements Document

**Version:** 1.0.0
**Status:** IN PROGRESS
**Completion Status:** 65%
**Pending Next:** Feature 5 — Agent Memory & Instruction Updates
**Last Sprint:** Sprint 3 — Agent Profile Panel — 2026-04-13

---

## Product Overview

**Foreman** is an AI agent creation and orchestration platform built for non-coders — specifically solo founders and product managers who are tool-comfortable (Notion, Figma, Linear, Slack) but cannot write code.

Users converse with **Scout**, Foreman's orchestrator, in plain English to create, manage, and run AI agents — their AI workforce. Agents are not automations. They are persistent, learning workers that get smarter with every run.

Scout is not a form builder or drag-and-drop tool. Scout is a solutions architect who asks smart questions, proposes workflow structures, and outputs production-ready agents. Users hire agents. Foreman manages the workforce.

---

## Target User

**Primary:** Non-coder solo founders and product managers

- Uses tools like Notion, Figma, Linear, Slack daily
- Has used ChatGPT or Claude — understands what AI can do
- Currently spending money or time on manual repetitive tasks (research, writing, analysis, reporting)
- Aware of API keys — can obtain and manage one from OpenAI, Anthropic, Gemini, or Groq
- Does NOT want to prompt engineer, build automations, or hire an AI engineer

**The pain they have today:**
They are using Cursor, Claude Code, or hiring AI engineers to set up workflows that should be simple. Foreman replaces that entirely.

---

## Core Concept: Scout's Intelligence Pattern

Every agent Scout builds must follow this exact loop:

```
Minimum context → Propose structure → Human checkpoint → Execute → Learn from feedback
```

Scout must:

- Ask only bare minimum questions to get started — never be naggy
- Ask for sample documents (past posts, past PRDs) only when context is genuinely insufficient — never upfront
- Propose the full workflow structure before executing anything
- Know whether a task needs API/secret access vs manual document upload — and design different workflows for each
- Pass all outputs correctly between every step via a global state object
- Update agent instructions permanently based on user feedback after every run

---

## Scout's Architecture — How She Stays Extraordinary

Scout does not generate workflows from scratch on every request. That would produce inconsistent, occasionally good, occasionally terrible results. Instead, Scout operates through five layers that guarantee extraordinary output for any task a user describes.

---

### Layer 1 — Intent Classification

Before Scout responds to a single message, she classifies the user's request into a task category. This happens silently, before the first reply.

| Category            | Examples                                                             |
| ------------------- | -------------------------------------------------------------------- |
| Content creation    | LinkedIn posts, newsletters, blog posts, social content              |
| Research & analysis | Competitor research, market analysis, trend reports                  |
| Document generation | PRDs, proposals, reports, SOPs, briefs                               |
| Data processing     | NPS analysis, survey results, sales data, spreadsheet processing     |
| Monitoring          | Price tracking, job posting alerts, news monitoring, website changes |
| Communication       | Email drafts, follow-ups, meeting summaries, outreach sequences      |
| Custom              | Any task that does not cleanly fit the above categories              |

Classification determines which question bank and workflow template Scout draws from in the layers below.

---

### Layer 2 — Minimum Question Bank (Per Category)

Each category has a predefined set of questions Scout can draw from. Scout never asks all of them. Scout only asks what the user has not already answered.

**Rule:** If the user's opening message already answers a question — Scout never asks it again.

Example for Content Creation:

- What platform is this for? (skip if user said "LinkedIn")
- Who is the target audience? (skip if user said "for developers")
- Do you have examples of your existing style? (ask only if tone/voice is unclear)
- How often should this run? (ask if no schedule was mentioned)
- Should I check your past content to avoid repetition? (always ask for content agents)

**Maximum 3 clarifying questions before Scout proposes the first blueprint.** If Scout needs more information, she asks after showing the blueprint — not before.

---

### Layer 3 — Workflow Templates Per Category

Each category has a battle-tested base workflow template. Scout starts from the template and customises it based on the user's specific task. She never builds from a blank canvas.

**Why this matters:** Templates encode the right workflow architecture for each task type. A monitoring agent always needs a "detect change" step before an "alert" step. A content agent always needs a "check past content" step before a "generate" step. These patterns are non-negotiable and built into the template — Scout cannot forget them.

**Content creation template (base):**

1. Research current trends / hot topics (AUTOMATED)
2. Check past content to avoid repetition (AUTOMATED)
3. Generate concept variations (AUTOMATED)
4. Human selects concept (MANUAL REVIEW — checkpoint)
5. Draft full content in user's voice (AUTOMATED)
6. Human approves or requests revision (MANUAL REVIEW — checkpoint)
7. Deliver final output (AUTOMATED)

Scout customises step names, objectives, inputs, and outputs based on the specific task. The structure is the template. The intelligence is the customisation.

---

### Layer 4 — Context Injection

Before generating any step instructions, Scout queries the user's stored context from Supabase:

- Business description
- Target customer
- 90-day goals
- Competitors
- Voice and tone preferences (if previously stored)

Scout injects **actual values** into every step instruction — never placeholders.

**Wrong (placeholder):**

```
INPUTS: The founder's target customer [insert here]
```

**Right (injected):**

```
INPUTS: The founder's target customer is non-coder solo founders and PMs
who are tool-comfortable but cannot code.
```

If context is missing, Scout asks for it conversationally — not via a form. And Scout stores whatever the user provides so she never asks the same question twice.

---

### Layer 5 — Step Instruction Quality Gate

Every generated step instruction passes through a quality validation before being displayed to the user. If any step fails validation, Scout regenerates that step silently before showing the blueprint.

**Validation rubric — every step must pass all five:**

| Check                         | Pass condition                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| OBJECTIVE clarity             | Defines a specific, measurable outcome — not a vague action                                                  |
| INPUTS specificity            | References actual named data sources — no "[insert X]" placeholders                                          |
| OUTPUT FORMAT precision       | Specifies exact structure (JSON, bullet list, paragraph count, word limit)                                   |
| QUALITY RULES measurability   | Standards are checkable — not subjective ("good writing" fails, "under 150 words, one hook, one CTA" passes) |
| FAILURE CONDITIONS definition | States exactly what a failed step looks like and what the agent should do                                    |

A blueprint is only shown to the user when every single step passes all five checks. No exceptions.

---

### The Result

A user who types "I want an agent that monitors competitor pricing and alerts me when something changes" gets:

- A correctly classified Monitoring agent
- Only the questions Scout genuinely needs answered
- A workflow built from the Monitoring template, customised for pricing and competitors
- Step instructions with their actual competitors injected — not "[insert competitor]"
- Every step validated before the blueprint appears

That is what makes Scout extraordinary across any task — not better prompts, but a deterministic five-layer system that enforces quality at every stage.

---

## Tech Stack

| Layer           | Technology                                   |
| --------------- | -------------------------------------------- |
| Frontend        | Next.js (App Router)                         |
| Backend         | Supabase (Postgres + Auth + Vault + Storage) |
| Auth            | Google OAuth via Supabase Auth               |
| Background jobs | Trigger.dev                                  |
| Web search      | Tavily API                                   |
| LLM providers   | OpenAI, Anthropic, Gemini, Groq (user BYOK)  |
| API key storage | Supabase Vault (encrypted at rest)           |
| Email           | Resend                                       |
| Deployment      | Vercel                                       |

---

## BYOK Architecture

Foreman does not pay for AI. Users bring their own API key.

- Supported providers at launch: **OpenAI, Anthropic, Gemini, Groq**
- Keys are encrypted immediately on input using **Supabase Vault**
- The `user_llm_config` table stores only a reference UUID — never the plaintext key
- On every agent run, the key is decrypted server-side via a Postgres RPC function (`get_service_secret`) and used only for the duration of that serverless function
- The plaintext key never touches the UI, local storage, or any database column
- Users select their preferred provider and model during onboarding

---

## Execution Engine Architecture

### Step Orchestration

- All agent runs are executed as background jobs via **Trigger.dev**
- The browser triggers a run and then disconnects — the workflow completes regardless of browser state
- Frontend polls Supabase every 3 seconds to display real-time step progress

### Global State (The Notepad)

- Every agent run maintains a **global JSON state object** stored in Supabase
- Each step reads from and writes to this shared state object
- No sliding window — every step has access to all outputs from all previous steps
- Example structure:

```json
{
  "hot_topics": ["AI agents", "Cursor"],
  "past_posts": ["post1", "post2"],
  "hooks": ["hook1", "hook2"],
  "status": "running",
  "current_step": 3
}
```

### Memory Layers

Two distinct layers — both stored in Supabase:

| Layer        | What it is                                               | Persistence                                         |
| ------------ | -------------------------------------------------------- | --------------------------------------------------- |
| Run state    | Current run's outputs and intermediate data              | Temporary — cleared after run completes or restarts |
| Agent memory | Permanent instructions, voice, preferences, past outputs | Never wiped — compounds with every run              |

### Checkpoint Handling

- When a step is marked as MANUAL REVIEW, Trigger.dev pauses the run
- Supabase state updates to `waiting_for_human`
- Frontend detects this state change via polling and renders the checkpoint UI
- User provides input (quick reply or free text)
- Frontend writes human input to Supabase global state
- Trigger.dev resumes from the next step with full context intact
- User can also reject the output entirely — triggers a fresh run from Step 1 with updated agent memory

### Multi-Run Logic

- **Checkpoint mid-workflow:** Pause → human input → resume from checkpoint step
- **User approves final output:** Run complete → outputs stored in agent memory
- **User rejects final output:** Scout asks what was wrong → feedback updates permanent agent instructions → fresh run from Step 1 with smarter agent

---

## Feature List

### Feature 1 — Authentication & BYOK Setup

> **Status: COMPLETE — 100%** · Deployed: foreman-green.vercel.app · Sprint closed: 2026-04-12

User signs in with Google, selects their LLM provider, and securely stores their API key.

**Screens:** Landing page → Google sign-in → Onboarding (provider selection + API key input) → Dashboard

**Acceptance criteria:**

- ✅ Google OAuth flow completes and creates user record in Supabase
- ✅ User selects provider (OpenAI / Anthropic / Gemini / Groq) and model
- ✅ API key is encrypted via Supabase Vault — plaintext never stored in any table
- ✅ User is redirected to empty dashboard on completion
- ✅ User can update their API key and provider from Settings at any time

---

### Feature 2 — Scout: Agent Creation via Conversation

> **Status: COMPLETE — 100%** · Built outside SOP · Sprint closed: 2026-04-13

User converses with Scout in plain English. Scout asks minimum questions, proposes a workflow, and the user hires the agent.

**Screens:** Create Agent page (split: Scout chat left, Workforce Blueprint right) → Review & Hire page

**Scout conversation rules:**

- Scout introduces itself briefly and asks one opening question: "What should this agent do?"
- Scout asks only the minimum questions needed — maximum 3 clarifying questions before proposing a blueprint
- Scout proposes the full workflow structure before writing any step instructions
- User can refine via continued conversation — blueprint updates in real time on the right panel
- Once user is satisfied, they proceed to Review & Hire

**Workforce Blueprint (right panel):**

- Updates in real time as Scout and user converse
- Displays: Agent name, schedule, output format, workflow steps
- Each step tagged as AUTOMATED or MANUAL REVIEW (checkpoint)
- User can expand any step to see full OBJECTIVE, INPUTS, OUTPUT FORMAT, QUALITY RULES, FAILURE CONDITIONS

**Review & Hire page:**

- Full list of all steps with complete instructions visible
- User can manually edit any step's instructions before hiring
- "Hire Agent" CTA — creates the agent record in Supabase and returns user to dashboard

**Step instruction format (enforced on every step Scout generates):**

```
OBJECTIVE: [What this step must accomplish]
INPUTS: [What data this step receives — from previous steps or from user]
OUTPUT FORMAT: [Exact structure of this step's output]
QUALITY RULES: [Standards the output must meet]
FAILURE CONDITIONS: [What counts as a failed step and what to do]
```

---

### Feature 3 — Agent Dashboard

> **Status: COMPLETE — 100%** · Built outside SOP

Overview of all hired agents with status, last run, next scheduled run, and key metrics.

**Screens:** Dashboard (agent cards)

**Each agent card displays:**

- Agent name
- Status (Active / Paused / Running / Failed)
- Last run timestamp
- Next scheduled run
- Total runs to date
- Total time saved (estimated human hours)
- Total cost to date ($)
- Quick actions: Run Now / Pause / Edit / Delete

---

### Feature 4 — Agent Execution & Real-Time Progress

> **Status: COMPLETE — 100%** · Built outside SOP · Run view output rendering fixed & verified in production · Sprint closed: 2026-04-13

User triggers a manual run or scheduled run fires. User sees live step-by-step progress.

**Screens:** Agent run view (step progress panel)

**Execution display:**

- Each step shows: Pending / Running (with spinner) / Complete (green check) / Failed (red X)
- Current step label: "Step 2 of 7 — Checking last 5 posts to avoid repetition..."
- Step output visible immediately on completion — no waiting for full run
- "Passed output to next step" indicator between steps

**Checkpoint UI:**

- Run pauses visibly at checkpoint step
- Checkpoint box renders with: step output, quick reply buttons, free text feedback input, Approve button
- Quick replies are context-aware (e.g., "Looks good, proceed" / "Revise the tone" / "Make it shorter")
- User input is submitted and run resumes — transition is immediate

**Run rejection:**

- After final step, user can reject the entire output
- Scout asks: "What wasn't right about this run?"
- User gives feedback in plain text
- Scout updates the agent's permanent instructions
- Fresh run begins immediately with updated memory

---

### Feature 5 — Agent Memory & Instruction Updates

> **Status: COMPLETE — 100%** · Built, debugged, and optimized for rate limits · Sprint closed: 2026-04-13

Agents get smarter with every run via permanent memory updates.

**How it works:**

- After every checkpoint approval or run rejection, Scout reads the user's feedback
- Scout rewrites the relevant section of the agent's permanent instructions
- User sees a "Memory Updated" indicator showing what changed
- Memory is stored in Supabase against the agent record
- Every subsequent run loads this memory into the agent's context before Step 1

**Memory content includes:**

- User's voice and tone preferences
- Past outputs (to avoid repetition)
- Business context specific to this agent's domain
- Quality standards learned from feedback

---

### Feature 6 — Cost & Value Dashboard

Users see exactly what their agents cost and what they save.

**Location:** Dedicated tab in Settings + summary on each agent card

**Metrics tracked per run:**

- Input tokens used
- Output tokens used
- Cost per run ($) — calculated using provider pricing dictionary
  - OpenAI, Anthropic, Gemini, Groq pricing tiers for input/output tokens
- Cumulative cost per agent ($)
- Cumulative cost across all agents ($)

**Time saved metric:**

- Each agent has an estimated "human hours per run" value — set by Scout during agent creation based on task type
- After every run: time saved = human hours estimate × runs completed
- Dashboard displays: "Your agents have saved you X hours this month"
- This is the primary conversion trigger for free → paid

**Conversion trigger:**
When time saved crosses a meaningful threshold (e.g., 10 hours), Foreman surfaces: _"Your agents saved you 10 hours this month. You're on the free plan. Unlock unlimited agents."_

---

### Feature 7 — Agent Scheduling

Agents run automatically on a user-defined schedule.

**Schedule options:**

- Manual only (user triggers every run)
- Fixed intervals: Daily, Weekly, Monthly
- Custom schedule: specific day(s) and time (e.g., every Monday and Thursday at 9:00 AM)

**Implementation:**

- Schedules stored in Supabase against agent record
- Trigger.dev handles scheduled job firing
- If a scheduled run hits a checkpoint, user receives an email notification via Resend with a link to the checkpoint review

---

### Feature 8 — Agent Editing Post-Hire

User can edit any agent's steps, schedule, or instructions after hiring.

**Screens:** Agent detail page → Edit mode

**Editable fields:**

- Agent name
- Schedule
- Any step's full instructions (OBJECTIVE, INPUTS, OUTPUT FORMAT, QUALITY RULES, FAILURE CONDITIONS)
- Add or remove steps
- Change step type (AUTOMATED ↔ MANUAL REVIEW)

**Not editable without re-hiring:**

- Core agent goal (requires conversation with Scout to rebuild)

---

### Feature 9 — Settings & Account Management

> **Status: COMPLETE — 100%** · Built outside SOP

User manages their account, API key, and provider.

**Screens:** Settings page (tabs: Account / API Key / Usage / Billing)

**Account tab:** Name, email, Google account linked
**API Key tab:** Current provider, model selection, update key, test connection
**Usage tab:** Token usage today, monthly cost, runs today, full cost dashboard
**Billing tab:** Current plan (Free), upgrade CTA

---

---

## Feature 10 — Agent Conversation

Users interact with each hired agent through a persistent Slack-style conversation window. This is the primary daily interface — not dashboards or logs.

**Screens:** Agent conversation (accessed from Workforce dashboard → agent card)

**Layout:**

- Left sidebar (200px) — standard app navigation, always visible
- Main area — full width conversation thread
- No right panel by default — profile opens as full screen overlay on click

**Conversation behaviour:**

- Each agent run creates a dated thread divider in the conversation: "Run #24 · Mon Apr 14 · 9:02 AM"
- Agent posts its output directly into the thread as a message
- User can reply to the agent in plain text — feedback, instructions, questions
- Agent responds conversationally and updates its permanent memory based on feedback
- Checkpoints appear inline in the conversation thread — user approves, revises, or requests a loop-back without leaving the screen
- Memory update tags appear after any instruction change: "🧠 Memory updated — max 100 words per post"
- User can type "run now" to trigger a manual run from the conversation

**Conversation header:**

- Agent avatar + name + current status (Active / Waiting for input / Running)
- Clicking the agent name or avatar opens the Agent Profile Panel
- "Run now" and "Pause" buttons always visible in header

**Input area:**

- Free text input — user can message the agent at any time, not just during runs
- Hint text: "Type a message, give feedback, or say 'run now'"

**Acceptance criteria:**

- Full conversation history persists across all runs
- Each run is visually separated by a dated divider
- Checkpoints render inline — no navigation to a separate screen
- Agent responses and outputs appear as messages
- Memory update tags appear immediately after any instruction change
- Clicking agent name opens profile panel

---

## Feature 11 — Agent Profile Panel

> **Status: COMPLETE — 100%** · Verified in production on foreman-green.vercel.app · Sprint closed: 2026-04-13

Full-screen overlay showing the agent's complete profile. Opened by clicking the agent name or avatar in the conversation header.

**Trigger:** Click agent name / avatar in conversation header

**Layout:** Full width overlay — sidebar remains visible, profile replaces the conversation area

**Profile hero:**

- Large agent avatar (48–56px)
- Agent name (DM Serif Display, 20–22px)
- Status + schedule + run count
- Action buttons: Run now / Edit workflow / Pause / Open conversation

**Stats bar (4 columns):**

- Total runs
- Time saved (this month)
- Total API cost (all time)
- Average run time

**Three tabs:**

### Memory tab

Shows what the agent has learned — split into two columns:

- Left: Voice & style (preference memories, confirmed feedback)
- Right: Topics & context (avoid list, what performs well, past outputs summary)

Each memory item shows:

- Memory type label (Preference / Episodic / Confirmed / Avoid / Performs well / Past outputs)
- Memory text content
- No edit in v1 — read only

### Workflow tab

Shows all steps with edit capability:

- Each step row: number circle, step name, Auto/Review tag, Edit button
- Edit button opens step edit modal (same as Review & Hire edit modal)
- Step edit modal includes Step type toggle (Automated ↔ Manual Review) — user can add or remove checkpoints post-hire
- Modal footer note: "Changes apply from the next run"
- Config section below steps: Schedule (with Change button), Provider, Output format

### Run history tab

- Full list of all runs — date, run number, status dot, duration, cost, word count if applicable
- Status: green dot (complete), red dot (failed), amber dot (waiting)

**Acceptance criteria:**

- Profile opens as full screen over main area — sidebar stays
- All three tabs functional
- Step edit modal works — saves changes to agent record
- Step type toggle works — converts step between Automated and Manual Review
- "Back to conversation" returns user to conversation view
- Changes from workflow edit apply from next run only — current run unaffected

---

## Feature 12 — Checkpoint Loop-Back

When a user reaches a checkpoint and is unsatisfied with all options presented, they can send the agent back to re-run upstream steps with new context rather than being forced to pick from unsatisfactory options.

**Trigger:** User clicks "Search again" / "Find different options" at a checkpoint, or types a rejection in free text

**What happens:**

1. User clicks loop-back quick reply or types rejection feedback
2. Agent stores the rejection context: which options were rejected and why
3. Agent loops back to the relevant upstream step (e.g. Step 1 for a topic generator)
4. Upstream steps re-run with the rejection injected as context — agent knows to find something different
5. Agent returns to the same checkpoint with new options
6. Rejected options stored in agent memory permanently — will not appear in future runs either

**UI during loop-back:**

- Sidebar shows upstream step with amber spinner ("Retrying...")
- Checkpoint step shows "Will return here"
- Main area shows: looping-back indicator (amber) + "What you asked for" card echoing user's feedback
- Footer note: "The agent has stored your rejected topics in memory. They won't appear again in this run or future runs."

**Checkpoint quick reply layout:**

- Row 1 label: "Pick a topic" — standard option quick replies (A, B, C)
- Divider line
- Row 2 label: "Not happy with these?" — loop-back quick reply (amber/yellow pill, visually distinct)
- Free text input + Send button below both rows

**Acceptance criteria:**

- Loop-back quick reply is visually distinct from selection quick replies (amber vs neutral)
- Rejected options injected into global state before loop-back begins
- Agent re-runs from correct upstream step — not from Step 1 always (depends on agent type)
- User's rejection reason displayed back to them during loop-back
- Rejected topics stored in permanent agent memory

---

## Memory Architecture — Three Layers

This updates Feature 5 (Agent Memory & Instruction Updates) with the full memory architecture.

### Layer 1 — Contextual Memory (v1)

The global JSON state object maintained during a single run. Contains all step outputs for the current run. Temporary — cleared when run completes or restarts. Already implemented as the global notepad.

### Layer 2 — Episodic Memory (v1.5 — post-launch)

Memories of specific past events and decisions, not just rules. Examples:

- "On run 12, user rejected Option B because it was too technical"
- "User said 'Love this one' on Apr 14 run — 94-word format confirmed"
- "User asked to avoid infrastructure topics on Apr 7"

Stored as structured records against each agent. Loaded into context alongside permanent instructions. Makes agents dramatically smarter over time — they remember the "why" behind decisions, not just the outcomes.

**Implementation:** Additional `agent_episodes` table in Supabase. Each episode has: run_id, type (rejection/approval/feedback), content, timestamp.

### Layer 3 — RAG Memory (v2 — scale)

Vector database query for large memory stores. When an agent has 50+ runs of memory, injecting all of it into context becomes expensive and hits token limits. RAG solves this — instead of injecting everything, the agent queries "what do I know about this user's LinkedIn voice?" and retrieves only the 5 most relevant memory chunks.

**Implementation:** Supabase pgvector extension. Each memory item embedded and stored as a vector. Retrieved via similarity search before each run.

### v1 Implementation

v1 ships with contextual memory (already built) + simple text blob permanent memory. Episodic and RAG are deferred to post-launch based on usage patterns.

| Phase     | Memory type                                   | Status      |
| --------- | --------------------------------------------- | ----------- |
| v1 launch | Contextual + text blob permanent memory       | Build now   |
| v1.5      | Episodic memory — structured decision records | Post-launch |
| v2        | RAG — vector DB for large memory stores       | At scale    |

## Pricing & Plans (v1)

| Plan | Price     | Agents                               | Runs      |
| ---- | --------- | ------------------------------------ | --------- |
| Free | $0        | Unlimited (no restriction at launch) | Unlimited |
| Pro  | $20/month | Unlimited                            | Unlimited |

**At launch:** No seat or run restrictions. Founder (you) uses the product intensively as the 0th user before any restrictions are enforced.

**Future:** Restrictions and conversion triggers will be introduced once usage patterns are understood from real usage data.

---

## The Four Test Cases (Acceptance Bar for Scout Quality)

Scout must handle all four of these extraordinarily before any user touches the product.

### Test 1 — LinkedIn Post Generator

- Runs weekly on a schedule
- Finds hot tech topics via Tavily web search
- On first run: asks user to paste their last 5 LinkedIn posts (stored in agent memory)
- Generates 2-3 hook variations
- MANUAL REVIEW checkpoint: user selects preferred topic and hook
- Drafts full post in user's voice
- Every run: stores generated posts in agent memory to avoid future repetition
- Run 10 post quality must be visibly better than Run 1

### Test 2 — PRD Generator

- Asks minimum business context questions (max 3)
- Proposes PRD section headers first — user approves before any content is written
- MANUAL REVIEW checkpoint at header approval stage
- If writing style context is insufficient: asks for 3 sample PRDs — not upfront, only when needed
- Generates full PRD section by section
- Memory compounds: agent learns user's preferred structure, depth, and tone over time

### Test 3 — Competitor Analysis Agent

- Asks minimum questions: what does your product do, who is it for, what problem does it solve
- Uses Tavily to identify genuinely relevant competitors based on that context (not generic ones)
- MANUAL REVIEW checkpoint: user confirms competitor list before deep analysis begins
- Runs full analysis on confirmed competitor list
- Memory: updates as user's product evolves

### Test 4 — NPS Analysis Agent

- Scout's first question: "Can your NPS platform connect via API/webhook, or will you upload a report manually?"
- **API path:** Scout designs automated workflow — agent runs on schedule, pulls data via secret/API key
- **Manual path:** Scout designs upload-triggered workflow — agent waits for CSV/document upload, then runs
- Scout never assumes — always asks first and designs the correct workflow based on the answer
- Secrets stored in Supabase Vault, never in step instructions

---

## Non-Negotiable Quality Standards

1. **Scout's first workflow output must be extraordinary** — not functional, not good. Extraordinary. One bad first impression = permanent churn.
2. **Output chaining between steps must be perfect** — every step has access to all previous step outputs via global state. No context amnesia.
3. **Agent memory must compound visibly** — users must feel the agent getting smarter. Run 10 ≠ Run 1.
4. **Checkpoint UX must be frictionless** — pause, review, approve in under 30 seconds.
5. **Zero silent failures** — if a step fails, the user sees exactly what failed and why in plain English. Never a spinner that never resolves.
6. **Cold start must show progress** — never just "Your agent is waking up..." with a spinner. Always "Step 1 of 7 — [step name]..."

---

## Out of Scope for v1

- Mobile app
- Template marketplace
- Team collaboration / multi-user
- Public agent sharing
- Integrations beyond Tavily web search (no Slack, no Gmail, no Notion)
- Complex multi-agent orchestration (one agent per task)
- Managed AI (Foreman paying for API costs)
- In-app notifications (email only for checkpoint alerts)

---

## Definition of Done for v1

A user who has never heard of Foreman can:

1. Sign in with Google
2. Enter their API key
3. Tell Scout what they want an agent to do — in plain English, for any task
4. Scout adapts to whatever the task is and builds an accurate Workforce Blueprint in real time
5. User hires the agent
6. Run it manually
7. Hit a checkpoint, review the output, approve it
8. See the final output delivered
9. See the cost and time saved on their dashboard
10. Come back on the next run and find the agent remembers everything from the last run and performs better

That is v1. Nothing more. Nothing less.
