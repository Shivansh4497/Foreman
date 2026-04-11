# Foreman — Sprint 1: Authentication & BYOK Setup Build Plan

**Feature:** Feature 1 — Authentication & BYOK Setup
**Objective:** Enable Google OAuth, provider selection, and secure BYOK (Bring Your Own Key) storage via Supabase Vault.

---

## Phase 1: Database & Supabase Configuration
- [x] **1.1** Initialize Supabase project and connect to local dev environment.
- [x] **1.2** Enable Google OAuth provider in Supabase Auth (configure Client ID, Client Secret, and Redirect URIs).
- [x] **1.3** Enable the Supabase Vault extension for secure API key encryption.
- [x] **1.4** Create the `users` table to sync with Supabase Auth (setup Postgres trigger on new user signup).
- [x] **1.5** Create the `user_llm_config` table with columns: `user_id` (uuid), `provider` (text), `model` (text), and `vault_secret_id` (uuid).
- [x] **1.6** Implement Row Level Security (RLS) policies on `users` and `user_llm_config` ensuring users can only read/update their own data.
- [x] **1.7** Create Postgres RPC function `get_service_secret(secret_id uuid)` to decrypt Vault keys server-side for agent runs.

## Phase 2: Base UI & Architecture Framework
- [x] **2.1** Initialize Next.js App Router project (if not already set up).
- [x] **2.2** Map global CSS tokens in `globals.css` using values from `SOT/design.md` (e.g., `--bg`, `--surface`, `--accent`, fonts).
- [x] **2.3** Configure `layout.tsx` with DM Sans and DM Serif Display font imports from Google Fonts.
- [x] **2.4** Build the standard Top Navigation component used across public/onboarding screens.
- [x] **2.5** Build the Sidebar navigation component used for internal app pages (Dashboard, Settings).

## Phase 3: Screen 01 & 02 — Landing Page & Sign In
- [x] **3.1** Build **S01**: Landing Page layout (Hero section, features grid, product preview).
- [x] **3.2** Build **S02**: Sign In Page layout (Centered auth card, exact typography).
- [x] **3.3** Implement Google OAuth frontend trigger on "Continue with Google" buttons.
- [x] **3.4** Create auth callback route (`/auth/callback`) to securely handle session establishment and redirect users (to `/dashboard` or onboarding based on existing data).

## Phase 4: Screen 03 & 04 — Onboarding (BYOK Setup)
- [x] **4.1** Implement onboarding step layout framework (centered card, back button, top progress dots).
- [x] **4.2** Build **S03**: Provider Selection screen (cards for OpenAI, Anthropic, Gemini).
- [x] **4.3** Build **S04**: API Key Input screen (password masking, explicit dark-mode-beating styles).
- [x] **4.4** Implement Next.js Server Action / API route `POST /api/keys/save`.
- [x] **4.5** Connect `POST /api/keys/save` to insert into Supabase Vault (`vault.secrets`) and update `user_llm_config`.
- [x] **4.6** Redirect user to `/dashboard` upon successful configuration.

## Phase 5: Routing, Middleware & Empty State
- [x] **5.1** Implement Next.js middleware to protect `/dashboard` and `/settings` (redirect unauthenticated users to `/`).
- [x] **5.2** Implement onboarding gate in middleware/layout: Redirect authenticated users to onboarding if `user_llm_config` is missing.
- [x] **5.3** Build **S05**: Dashboard empty state UI (Welcome banner, "Hire new agent" CTA, lightning bolt graphic).
- [x] **5.4** Validate correct routing: New user -> Google Login -> Onboarding -> Empty Dashboard.

## Phase 6: Settings — Update API Key (Flow 1.4)
- [x] **6.1** Build Settings page layout framework (Sidebar integration + Tabs: Account, API Key, Usage, Billing).
- [x] **6.2** Build API Key tab UI (**S30**) with current provider details and new key input.
- [x] **6.3** Create server action to update provider/key (Deletes old Vault secret, inserts new secret, updates `user_llm_config` reference UUID).
- [x] **6.4** Add UI feedback (success state) upon successful key update.

## Phase 7: Polish & Security Validation
- [x] **7.1** Verify UI matches `design.md` exactly (button padding, rounded corners, input background overrides for dark mode).
- [x] **7.2** Test complete happy path for returning user: Google Login -> Directly to Dashboard.
- [x] **7.3** Security confirmation: Search the codebase to verify the plaintext API key is never rendered on the frontend or logged in server output.
- [x] **7.4** Security confirmation: Validate Supabase RLS enforces strictly scoped read/writes to `user_llm_config`.
