CREATE OR REPLACE FUNCTION public.insert_secret(name text, secret text, description text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  secret_id uuid;
BEGIN
  -- Call the vault extension's native create_secret function
  -- Positional args: vault.create_secret(secret, name, description)
  SELECT vault.create_secret(secret, name, description) INTO secret_id;
  
  RETURN secret_id;
END;
$$;

-- Secure the function by removing public execution rights (preventing client-side access)
REVOKE EXECUTE ON FUNCTION public.insert_secret(text, text, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.insert_secret(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.insert_secret(text, text, text) FROM authenticated;

-- Only allow service_role to execute this function securely
GRANT EXECUTE ON FUNCTION public.insert_secret(text, text, text) TO service_role;
