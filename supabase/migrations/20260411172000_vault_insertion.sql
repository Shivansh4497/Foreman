-- Phase 4.5: RPC to securely insert API keys into Supabase Vault and update user_llm_config
create or replace function public.insert_vault_secret_admin(user_id uuid, secret_value text, provider_name text, model_name text)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  new_secret_id uuid;
begin
  -- Optional fallback logic inside the function body
  if current_setting('request.jwt.claims', true)::json->>'role' = 'authenticated' then
    if auth.uid() != user_id then
      raise exception 'Unauthorized caller hijacking user ID';
    end if;
  end if;

  -- Create secret in vault
  select id into new_secret_id from vault.create_secret(secret_value, 'llm_key_' || user_id::text || '_' || provider_name);

  -- Upsert config
  insert into public.user_llm_config (user_id, provider, model, vault_secret_id)
  values (user_id, provider_name, model_name, new_secret_id)
  on conflict (user_id) do update 
  set provider = excluded.provider,
      model = excluded.model,
      vault_secret_id = excluded.vault_secret_id,
      updated_at = timezone('utc'::text, now());

  return new_secret_id;
end;
$$;

-- CRITICAL SECURITY ENFORCEMENT:
-- Prevent 'anon' and 'authenticated' frontend roles from manually overriding vault inserts
-- via the Security Definer RPC. Only Service Role Backend can invoke this safely based on token validation.
REVOKE EXECUTE ON FUNCTION public.insert_vault_secret_admin(uuid, text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.insert_vault_secret_admin(uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_vault_secret_admin(uuid, text, text, text) TO service_role;
