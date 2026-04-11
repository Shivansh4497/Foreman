-- Phase 1.3: Enable the Supabase Vault extension for secure API key encryption.
create extension if not exists "supabase_vault" with schema "vault";

-- Phase 1.4: Create the `users` table to sync with Supabase Auth.
create table public.users (
  id uuid references auth.users(id) on delete cascade not null primary key,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Phase 1.6: Implement RLS for `users`
alter table public.users enable row level security;

create policy "Users can view their own record"
  on public.users for select
  using ( auth.uid() = id );

create policy "Users can update their own record"
  on public.users for update
  using ( auth.uid() = id );

-- Set up Postgres trigger on new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Phase 1.5: Create the `user_llm_config` table.
create table public.user_llm_config (
  user_id uuid references public.users(id) on delete cascade not null primary key,
  provider text not null,
  model text not null,
  vault_secret_id uuid not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Phase 1.6: Implement RLS for `user_llm_config`
alter table public.user_llm_config enable row level security;

create policy "Users can view their own LLM config"
  on public.user_llm_config for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own LLM config"
  on public.user_llm_config for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own LLM config"
  on public.user_llm_config for update
  using ( auth.uid() = user_id );

create policy "Users can delete their own LLM config"
  on public.user_llm_config for delete
  using ( auth.uid() = user_id );

-- Phase 1.7: Create Postgres RPC function `get_service_secret(secret_id uuid)`
create or replace function public.get_service_secret(secret_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  secret_value text;
begin
  -- Validate the secret exists and belongs to the calling user's config
  -- Allow Trigger.dev service role to read secrets for agent execution
  if current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' then
    if not exists (
      select 1 from public.user_llm_config 
      where vault_secret_id = secret_id
    ) then
      raise exception 'Secret not found in config';
    end if;
  else
    if not exists (
      select 1 from public.user_llm_config 
      where vault_secret_id = secret_id and user_id = auth.uid()
    ) then
      raise exception 'Unauthorized or secret not found';
    end if;
  end if;

  select decrypted_secret into secret_value
  from vault.decrypted_secrets
  where id = secret_id;

  return secret_value;
end;
$$;
