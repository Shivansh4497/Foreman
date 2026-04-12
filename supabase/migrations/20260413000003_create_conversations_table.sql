-- Step 1.3: Create the `conversations` table.
create table public.conversations (
  id         uuid        primary key default gen_random_uuid(),
  agent_id   uuid        not null references public.agents(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  role       text        not null,
  content    text        not null,
  created_at timestamptz not null default now()
);

-- Index for chronological retrieval per agent (per spec note in 1.3).
create index conversations_agent_created_idx
  on public.conversations (agent_id, created_at);

-- Step 1.4 (conversations): Enable RLS and define policies.
-- Note: per spec 1.4, conversations allows SELECT and INSERT only (no UPDATE / DELETE).
alter table public.conversations enable row level security;

create policy "conversations_select_own"
  on public.conversations for select
  using ( auth.uid() = user_id );

create policy "conversations_insert_own"
  on public.conversations for insert
  with check ( auth.uid() = user_id );
