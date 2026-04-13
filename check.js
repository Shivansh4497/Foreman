// check.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/director/Desktop/Foreman/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: runs, error } = await supabase
    .from('agent_runs')
    .select('id, agent_id, global_state')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) console.error("Error fetching runs:", error);

  console.log("RECENT RUNS ===================================================");
  for (const run of runs) {
    console.log(`Run: ${run.id} | Agent: ${run.agent_id}`);
    const gs = run.global_state;
    console.log("Memory in GS?", gs.step_4_human_feedback ? "YES" : "NO");
    console.log("Processed feedback:", gs.processed_feedback);
    
    // Check the actual agent
    const { data: agent } = await supabase.from('agents').select('agent_memory').eq('id', run.agent_id).single();
    console.log(`Agent ${run.agent_id} memory:`, JSON.stringify(agent?.agent_memory));
    console.log("-------------------------------------------------------------");
  }
}

check();
