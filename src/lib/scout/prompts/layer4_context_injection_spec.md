# Layer 4 — Context Injection Specification
**File:** src/lib/scout/prompts/layer4_context_injection_spec.md
**Version:** 1
**Last updated:** 2026-04-13T00:25:00+05:30
**Used by:** POST /api/scout/message — executed between Layer 1 and Layer 2, before any LLM call that receives `user_context`
**This is a specification document — not a prompt.** @builder reads this to know exactly which Supabase queries to run and exactly which variables to construct before calling Layer 2 or Layer 3.

---

## Purpose

Before Layer 2 (question selection) or Layer 3 (blueprint generation) is called, the API route must query Supabase for the user's stored context and assemble a `user_context` object. This object is injected as a variable into both Layer 2 and Layer 3 prompts.

This document defines:
1. Exactly which Supabase queries to run
2. Exactly how to assemble the `user_context` object
3. Exactly how to handle null, missing, or partially populated values
4. The fallback order when a value is not in the database

---

## The `user_context` Object

This is the object that gets injected as `{{user_context}}` in Layer 2 and Layer 3 prompts.

```typescript
interface UserContext {
  business_description: string | null;
  target_customer: string | null;
  goals_90_day: string | null;
  competitors: string | null;
  voice_tone: string | null;
}
```

**Rule:** All five fields must always be present in the object. Fields with no value must be `null` — never `undefined`, never omitted, never an empty string `""`.

---

## Step 1 — Query: `users` table

Run a single SELECT for the authenticated user:

```sql
SELECT
  business_description,
  target_customer,
  goals_90_day,
  competitors
FROM users
WHERE id = auth.uid()
LIMIT 1;
```

**Expected result:** One row or zero rows.

- If one row is returned: extract the four columns. Any column that is `NULL` in the database stays `null` in the context object.
- If zero rows are returned (user profile not yet created): all four fields are `null`.

> **Note for @builder:** The `users` table already exists from Sprint 1. If `business_description`, `target_customer`, `goals_90_day`, or `competitors` columns do not exist on the `users` table, this is a schema gap that must be escalated to human before proceeding. Do not silently ignore missing columns.

---

## Step 2 — Query: `agents` table (voice_tone from prior agent memory)

`voice_tone` is not stored directly on `users`. It is learned from agent memory. Query the most recent active or completed agent owned by this user in the same category, if one exists:

```sql
SELECT agent_memory
FROM agents
WHERE user_id = auth.uid()
  AND category = $1
  AND status IN ('active', 'paused')
  AND agent_memory IS NOT NULL
  AND agent_memory != ''
ORDER BY updated_at DESC
LIMIT 1;
```

**Parameters:**
- `$1` = the `category` value from Layer 1 output (e.g. `'content_creation'`)

**Value extraction:**
- If a row is returned: set `voice_tone = agent_memory` (the full text blob — Layer 3 will extract the relevant voice/tone information from it)
- If no row is returned: set `voice_tone = null`

**Fallback:** If no prior agent of the same category exists, try querying without the category filter to see if any agent has memory that includes voice/tone guidance:

```sql
SELECT agent_memory
FROM agents
WHERE user_id = auth.uid()
  AND status IN ('active', 'paused')
  AND agent_memory IS NOT NULL
  AND agent_memory ILIKE '%voice%'
ORDER BY updated_at DESC
LIMIT 1;
```

If the fallback also returns nothing: `voice_tone = null`.

---

## Step 3 — Conversation History Fallback

If one or more `user_context` fields are `null` after Steps 1 and 2, scan the `conversation_history` array (already loaded in Step 2 of the API route) for user messages that contain the missing information.

Apply these extraction heuristics in order:

| Field | Look for in conversation | Example |
|---|---|---|
| `business_description` | Any user message containing "I build", "my product", "my company", "we do", "my startup" | "My startup is an AI agent platform for founders" → `business_description = "AI agent platform for founders"` |
| `target_customer` | Any user message containing "for", "my audience", "my customers", "target", "who", "founders", "PMs" | "for non-coder solo founders" → `target_customer = "non-coder solo founders"` |
| `goals_90_day` | Any user message containing "I want to", "my goal", "trying to", "this quarter", "90 days" | — |
| `competitors` | Any user message naming specific companies as competitors | "our competitors are Zapier, Make, and Relevance AI" → `competitors = "Zapier, Make, Relevance AI"` |
| `voice_tone` | Any user message with style instructions: "in my voice", "punchy", "no jargon", "casual", "formal" | "Direct and punchy, no fluff" → `voice_tone = "Direct and punchy, no fluff"` |

**Rule:** Only use conversation extraction as a fallback for fields that are `null` after the database queries. If a field is populated from the database, do not overwrite it with a conversation extract — the database value is canonical.

**Rule:** If a field cannot be populated from either the database or conversation scanning, leave it as `null`. Never invent a value, never guess.

---

## Step 4 — Assemble the Final Object

Merge all sources into one `user_context` object following this priority order:

```
Priority 1 (highest): users table query result
Priority 2: agents table agent_memory (for voice_tone only)
Priority 3: Conversation history extraction
Priority 4 (lowest): null
```

**Final assembly example:**

```typescript
const user_context: UserContext = {
  business_description: usersRow?.business_description ?? conversationExtract.business_description ?? null,
  target_customer: usersRow?.target_customer ?? conversationExtract.target_customer ?? null,
  goals_90_day: usersRow?.goals_90_day ?? conversationExtract.goals_90_day ?? null,
  competitors: usersRow?.competitors ?? conversationExtract.competitors ?? null,
  voice_tone: agentMemoryRow?.agent_memory ?? conversationExtract.voice_tone ?? null,
};
```

---

## Step 5 — Inject into Prompts

Serialise `user_context` as a JSON string and substitute it for `{{user_context}}` in both:
- Layer 2 prompt (`layer2_question_bank.txt`)
- Layer 3 prompt (`layer3_blueprint_generation.txt`)

```typescript
const user_context_json = JSON.stringify(user_context);
// Substitute into prompt before sending to LLM
const prompt = layer2Template.replace('{{user_context}}', user_context_json);
```

**Rule:** Always inject the full object — even if all values are null. Never skip the injection. A fully-null context object tells the LLM to ask for the missing information. A missing variable causes prompt corruption.

---

## Error Handling Rules

| Scenario | Action |
|---|---|
| `users` table query fails with DB error | Log error. Set all four `users` fields to `null`. Do not halt. |
| `agents` table query fails with DB error | Log error. Set `voice_tone` to `null`. Do not halt. |
| `users` table columns do not exist | Escalate to human. Do not proceed with null silently if columns are genuinely absent from schema. |
| All five fields are `null` | This is valid — continue with all nulls. Layer 2 will ask the right questions. Layer 3 will build the best blueprint possible from conversation content only. |
| Partial nulls (2-3 fields populated) | Valid and expected — continue. |

---

## Variable Injection Summary Table

| Variable in Prompt | Source | Query | Fallback |
|---|---|---|---|
| `business_description` | `users.business_description` | `SELECT business_description FROM users WHERE id = auth.uid()` | Conversation scan → null |
| `target_customer` | `users.target_customer` | `SELECT target_customer FROM users WHERE id = auth.uid()` | Conversation scan → null |
| `goals_90_day` | `users.goals_90_day` | `SELECT goals_90_day FROM users WHERE id = auth.uid()` | Conversation scan → null |
| `competitors` | `users.competitors` | `SELECT competitors FROM users WHERE id = auth.uid()` | Conversation scan → null |
| `voice_tone` | `agents.agent_memory` | `SELECT agent_memory FROM agents WHERE user_id = auth.uid() AND category = $1 ORDER BY updated_at DESC LIMIT 1` | Cross-category fallback → conversation scan → null |

---

## What @builder Must NOT Do

- Do NOT call a separate API or service to fetch context. All values come from Supabase only.
- Do NOT include the user's raw API key or any Vault secret in `user_context`. This object is passed to LLMs — it must never contain secrets.
- Do NOT omit a field from the object even if its value is null.
- Do NOT cache `user_context` across requests. Always query fresh on every `/api/scout/message` call — context may have changed since the last turn.

---

## Changelog
- v1 — 2026-04-13T00:25:00+05:30 — Initial specification. Defines 5 variables, 2 Supabase queries, conversation fallback logic, and priority order.
