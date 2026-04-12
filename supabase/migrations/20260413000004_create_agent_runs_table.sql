-- Blueprint for executing background jobs via PRD specifications.
create table public.agent_runs (
  id           uuid        primary key default gen_random_uuid(),
  agent_id     uuid        not null references public.agents(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  run_number   integer     not null default 1,
  status       text        not null default 'pending', -- pending, running, waiting_for_human, completed, failed
  global_state jsonb       not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);

-- Enable Row Level Security (RLS)
alter table public.agent_runs enable row level security;

-- Policies for owner
create policy "agent_runs_select_own"
  on public.agent_runs for select
  using ( auth.uid() = user_id );

create policy "agent_runs_insert_own"
  on public.agent_runs for insert
  with check ( auth.uid() = user_id );

create policy "agent_runs_update_own"
  on public.agent_runs for update
  using ( auth.uid() = user_id );

create policy "agent_runs_delete_own"
  on public.agent_runs for delete
  using ( auth.uid() = user_id );
