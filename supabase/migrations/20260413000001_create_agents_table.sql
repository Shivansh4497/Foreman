-- Step 1.1: Create the `agents` table.
create table public.agents (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references auth.users(id) on delete cascade,
  name                    text,
  status                  text        not null default 'draft',
  schedule                text,
  category                text,
  blueprint_json          jsonb,
  agent_memory            text,
  human_hours_per_run     numeric,
  trigger_dev_schedule_id text,
  total_runs              integer     not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Step 1.4 (agents): Enable RLS and define policies.
alter table public.agents enable row level security;

create policy "agents_select_own"
  on public.agents for select
  using ( auth.uid() = user_id );

create policy "agents_insert_own"
  on public.agents for insert
  with check ( auth.uid() = user_id );

create policy "agents_update_own"
  on public.agents for update
  using ( auth.uid() = user_id );

create policy "agents_delete_own"
  on public.agents for delete
  using ( auth.uid() = user_id );
