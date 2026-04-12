-- Step 1.2: Create the `agent_steps` table.
create table public.agent_steps (
  id                    uuid        primary key default gen_random_uuid(),
  agent_id              uuid        not null references public.agents(id) on delete cascade,
  user_id               uuid        not null references auth.users(id) on delete cascade,
  step_number           integer     not null,
  name                  text        not null,
  step_type             text        not null,
  objective             text        not null,
  inputs                text        not null,
  output_format         text        not null,
  quality_rules         text        not null,
  failure_conditions    text        not null,
  loop_back_step_number integer,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Step 1.4 (agent_steps): Enable RLS and define policies.
alter table public.agent_steps enable row level security;

create policy "agent_steps_select_own"
  on public.agent_steps for select
  using ( auth.uid() = user_id );

create policy "agent_steps_insert_own"
  on public.agent_steps for insert
  with check ( auth.uid() = user_id );

create policy "agent_steps_update_own"
  on public.agent_steps for update
  using ( auth.uid() = user_id );

create policy "agent_steps_delete_own"
  on public.agent_steps for delete
  using ( auth.uid() = user_id );
