-- Add trigger_task_id to track Trigger.dev runs
ALTER TABLE public.agent_runs ADD COLUMN IF NOT EXISTS trigger_task_id TEXT;
