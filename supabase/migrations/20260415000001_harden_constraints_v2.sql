-- ============================================================
-- Migration: 20260415000001 — Harden Constraints v2
-- Fixes agents.status constraint (incomplete in v1) and adds
-- run_number auto-computation via trigger for correctness.
-- ============================================================

-- 1. Fix agents.status constraint (v1 only had draft/active/running)
ALTER TABLE public.agents
DROP CONSTRAINT IF EXISTS agents_status_check;

ALTER TABLE public.agents
ADD CONSTRAINT agents_status_check
CHECK (status IN ('draft', 'active', 'paused', 'running', 'failed', 'waiting', 'waiting_for_human'));

-- 2. Make run_number auto-computed from count at insert time
--    via a BEFORE INSERT trigger so it is always accurate regardless
--    of race conditions in application code.

CREATE OR REPLACE FUNCTION public.set_run_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT COALESCE(MAX(run_number), 0) + 1
    INTO NEW.run_number
    FROM public.agent_runs
   WHERE agent_id = NEW.agent_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_run_number ON public.agent_runs;

CREATE TRIGGER trg_set_run_number
BEFORE INSERT ON public.agent_runs
FOR EACH ROW
EXECUTE FUNCTION public.set_run_number();

-- 3. Ensure updated_at is always kept current on any update
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_runs_updated_at ON public.agent_runs;

CREATE TRIGGER trg_agent_runs_updated_at
BEFORE UPDATE ON public.agent_runs
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at();
