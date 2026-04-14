-- 1. Status Integrity Constraints
ALTER TABLE public.agent_runs 
DROP CONSTRAINT IF EXISTS agent_runs_status_check;

ALTER TABLE public.agent_runs 
ADD CONSTRAINT agent_runs_status_check 
CHECK (status IN ('pending', 'running', 'waiting_for_human', 'completed', 'failed', 'cancelled'));

ALTER TABLE public.agents 
DROP CONSTRAINT IF EXISTS agents_status_check;

ALTER TABLE public.agents 
ADD CONSTRAINT agents_status_check 
CHECK (status IN ('draft', 'active', 'running'));

-- 2. DB Guardrail: one active run per agent
-- Note: We use a partial unique index to allow multiple historical (completed/failed/cancelled) runs
-- but only one active run (pending, running, waiting_for_human).
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_run_per_agent 
ON public.agent_runs (agent_id) 
WHERE status IN ('pending', 'running', 'waiting_for_human');

-- 3. Run number correctness (Optional: Migration to fix any existing null/0 run_numbers if needed)
-- (Existing table already has run_number integer not null default 1)
