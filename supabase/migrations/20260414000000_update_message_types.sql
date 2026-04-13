-- Add 'run_card' to the message_type check constraint
ALTER TABLE agent_conversations 
DROP CONSTRAINT IF EXISTS agent_conversations_message_type_check;

ALTER TABLE agent_conversations 
ADD CONSTRAINT agent_conversations_message_type_check 
CHECK (message_type IN ('text', 'run_divider', 'memory_update', 'output', 'run_card'));
