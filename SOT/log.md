# Foreman — Sprint Log

---
## Feature 1 — Authentication & BYOK Setup Sprint Log
**Timestamp:** 2026-04-12T14:49:00Z
**Sprint status:** COMPLETE

### Agents
| Agent | Status | Notes |
|-------|--------|-------|
| @architect | COMPLETE | — |
| @builder (backend) | COMPLETE | — |
| @builder (frontend) | COMPLETE | — |
| @critic | COMPLETE WITH PATCHES APPLIED | 6 critical patches |

### Files Mutated
- `src/lib/supabase/client.ts` — replaced `supabase-js` with `@supabase/ssr` browser client
- `src/lib/supabase/server.ts` — replaced `supabase-js` with `@supabase/ssr` server client (cookie-based)
- `src/middleware.ts` — rewrote to fix passthrough vulnerability; proper auth guard with `@supabase/ssr`
- `src/app/auth/callback/route.ts` — full rewrite to handle PKCE code exchange correctly; awaited `cookies()`
- `src/app/api/keys/save/route.ts` — rebuilt from scratch using service role client + native `insert_secret` RPC; removed all plaintext key logging
- `src/components/AuthGuard.tsx` — simplified; uses `@supabase/ssr` session, correct onboarding redirect
- `src/components/Sidebar.tsx` — updated nav links and auth-aware sign-out
- `src/app/page.tsx` — landing page with correct `signInWithOAuth` redirect URL
- `src/app/onboarding/page.tsx` — provider selection + API key input screens
- `src/app/dashboard/layout.tsx` — two-column layout wrapping `Sidebar` + `AuthGuard`
- `src/app/dashboard/page.tsx` — empty state UI
- `src/app/settings/page.tsx` — settings shell with API Key update tab
- `supabase/migrations/20260412000000_drop_broken_vault_fn.sql` — drops obsolete `public.insert_vault_secret_admin` function
- `supabase/migrations/*_get_service_secret.sql` — patched `get_service_secret` to support Trigger.dev service role in addition to `auth.uid()`

### Critic Summary
Critical patches: 6
Non-critical observations: 0 (see full audit in session c6a36475-4837-4489-b5d7-79c223c58dcf)

**Patches applied:**
1. Wrong Supabase client package (`supabase-js` → `@supabase/ssr`) — broken session handling
2. Middleware passthrough vulnerability — unauthenticated requests reaching protected routes
3. API key plaintext log leak — removed from server-side logs
4. `get_service_secret` service role fix — was scoped only to `auth.uid()`, blocked Trigger.dev calls
5. PKCE callback route rewrite — code exchange was not being awaited correctly in Next.js 16
6. `insert_secret` native RPC replacing broken custom function — `public.insert_vault_secret_admin` was non-functional

### SOT Drift
None detected.

### Human Verification
VERIFIED — deployed and confirmed working in production at foreman-green.vercel.app

---
