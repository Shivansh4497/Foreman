'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, useMemo, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import ProfilePanel from '@/components/profile/ProfilePanel';

// --- Types ---

interface Agent {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'running' | 'failed' | 'waiting' | 'waiting_for_human';
  total_runs: number;
  schedule?: string;
  agent_memory?: string;
  human_hours_per_run?: number;
  created_at?: string;
}

interface Step {
  step_number: number;
  name: string;
  step_type: 'auto' | 'review' | 'manual_review';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting' | 'waiting_for_human';
  output: string | null;
}

interface RunMetadata {
  run_number: number;
  status: 'completed' | 'failed' | 'running' | 'waiting_for_human';
  step_count: number;
  duration_seconds: number;
  output_preview: string;
  full_output?: string;
  error?: string;
  steps: Step[];
}

interface Message {
  id: string;
  agent_id: string;
  user_id: string;
  run_id?: string;
  role: 'user' | 'agent';
  message_type: 'text' | 'run_card' | 'memory_update' | 'run_divider';
  content: string;
  metadata?: RunMetadata;
  created_at: string;
}

interface AgentRun {
  id: string;
  agent_id: string;
  status: string;
  global_state: any;
  created_at: string;
}

// --- Components ---

const DayDivider = ({ date }: { date: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0 12px' }}>
    <div style={{ flex: 1, height: '1px', background: '#D4CFC6' }} />
    <span style={{ fontSize: '11px', fontWeight: 600, color: '#7A7770' }}>{date}</span>
    <div style={{ flex: 1, height: '1px', background: '#D4CFC6' }} />
  </div>
);

const Badge = ({ status, pulse }: { status: string; pulse?: boolean }) => {
  let bg = '#F0EEE9';
  let color = '#7A7770';
  let label = status;

  switch (status.toLowerCase()) {
    case 'completed':
    case 'done':
      bg = '#EAF5EE';
      color = '#1A7A4A';
      label = '✓ Done';
      break;
    case 'failed':
      bg = '#FEE2E2';
      color = '#991B1B';
      label = '✗ Failed';
      break;
    case 'running':
      bg = '#EEF2FB';
      color = '#2E5BBA';
      label = 'Running';
      break;
    case 'waiting_for_human':
    case 'waiting':
      bg = '#FEF3DC';
      color = '#8A5C00';
      label = 'Waiting';
      break;
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '3px 9px',
      borderRadius: '100px',
      fontSize: '11px',
      fontWeight: 600,
      background: bg,
      color: color,
    }}>
      {pulse && (
        <div style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: color,
          animation: 'pulse 1.2s ease-in-out infinite',
        }} />
      )}
      {label}
    </div>
  );
};

const getStepBadge = (stepType: string) => {
  const t = stepType?.toLowerCase() || '';
  if (t === 'manual_review' || t === 'review') {
    return { label: 'REVIEW', bg: '#FEF3DC', color: '#8A5C00' };
  }
  return { label: 'AUTO', bg: '#EAF5EE', color: '#1A7A4A' };
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const RunCard = ({ message, isExpanded, onToggle }: { message: Message; isExpanded: boolean; onToggle: () => void }) => {
  const metadata = message.metadata;
  if (!metadata) return null;

  const date = new Date(message.created_at);
  const formattedDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const headerStr = `Run #${metadata.run_number} · ${formattedDate} · ${timeStr}`;

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #D4CFC6',
      borderRadius: '12px',
      overflow: 'hidden',
      marginBottom: '16px',
      maxWidth: '600px',
      alignSelf: 'flex-start',
      width: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '11px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #D4CFC6',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1A1916' }}>
          {headerStr}
        </div>
        <Badge status={metadata.status} />
      </div>

      {!isExpanded ? (
        <>
          {metadata.output_preview && (
            <div style={{ padding: '10px 16px', fontSize: '13px', color: '#4A4845', lineHeight: '1.6' }}>
              {metadata.output_preview.substring(0, 120)}{metadata.output_preview.length > 120 ? '...' : ''}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 16px 10px' }}>
            <button 
              onClick={onToggle}
              style={{ fontSize: '12px', fontWeight: 500, color: '#2E5BBA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              Know more ↓
            </button>
          </div>
        </>
      ) : (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #D4CFC6' }}>
            {metadata.steps?.map((step, idx) => (
              <StepRow key={idx} step={step} isLast={idx === metadata.steps.length - 1} />
            ))}
          </div>
          <div style={{ padding: '14px 16px', background: '#F7F6F3', fontSize: '13px', color: '#1A1916', lineHeight: '1.7', whiteSpace: 'pre-line' }}>
            {metadata.full_output}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 16px 10px' }}>
            <button 
              onClick={onToggle}
              style={{ fontSize: '12px', fontWeight: 500, color: '#2E5BBA', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              Close ↑
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const StepRow = ({ step, isLast }: { step: Step; isLast: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const getIcon = () => {
    switch (step.status) {
      case 'completed': return { char: '✓', bg: '#EAF5EE', color: '#1A7A4A' };
      case 'failed': return { char: '✗', bg: '#FEE2E2', color: '#991B1B' };
      case 'waiting_for_human':
      case 'waiting': return { char: '⏸', bg: '#FEF3DC', color: '#8A5C00' };
      case 'running': return { char: '', bg: '#EEF2FB', color: '#2E5BBA', spinner: true };
      default: return { char: step.step_number.toString(), bg: '#F0EEE9', color: '#7A7770' };
    }
  };

  const icon = getIcon();
  const badge = getStepBadge(step.step_type);

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid #F0EEE9' }}>
      <div 
        onClick={() => step.output && setIsOpen(!isOpen)}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', cursor: step.output ? 'pointer' : 'default' }}
      >
        <div style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: icon.bg,
          color: icon.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: 600,
          border: icon.spinner ? '2px solid #2E5BBA' : 'none',
          position: 'relative'
        }}>
          {icon.spinner ? (
            <div style={{
              width: '14px', height: '14px', border: '2px solid rgba(46, 91, 186, 0.2)',
              borderTopColor: '#2E5BBA', borderRadius: '50%', animation: 'spin 1s linear infinite'
            }} />
          ) : icon.char}
        </div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#1A1916', flex: 1 }}>{step.name}</div>
        <div style={{
          background: badge.bg,
          color: badge.color,
          fontSize: '10px',
          fontWeight: 600,
          padding: '2px 7px',
          borderRadius: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.3px'
        }}>
          {badge.label}
        </div>
      </div>
      {isOpen && step.output && (
        <div style={{
          background: '#F7F6F3',
          borderRadius: '6px',
          padding: '8px 10px',
          margin: '4px 0 4px 30px',
          fontSize: '12px',
          color: '#4A4845',
          lineHeight: 1.5,
          maxHeight: '120px',
          overflow: 'hidden'
        }}>
          {step.output}
        </div>
      )}
    </div>
  );
};

const LiveRunWidget = ({ runId, agentId, onComplete }: { runId: string, agentId: string, onComplete: () => void }) => {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [resumeLoading, setResumeLoading] = useState(false);

  useEffect(() => {
    async function poll() {
      const { data: runData } = await supabase.from('agent_runs').select('*').eq('id', runId).single();
      if (runData) {
        setRun(runData);
      }

      const { data: stepsData } = await supabase.from('agent_steps')
        .select('*')
        .eq('agent_id', agentId)
        .order('step_number', { ascending: true });
      if (stepsData) setSteps(stepsData);
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [runId, agentId, onComplete]);

  const handleResume = async (feedback?: string) => {
    setResumeLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/runs/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ run_id: runId, human_feedback: feedback })
      });
    } catch (e) { console.error(e); }
    setResumeLoading(false);
  };

  if (!run) return null;

  const stepStatuses = run.global_state?.step_statuses || {};

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #D4CFC6',
      borderRadius: '12px',
      overflow: 'hidden',
      marginBottom: '12px',
      maxWidth: '640px',
      alignSelf: 'flex-start',
      width: '100%',
      animation: 'fadeInUp 0.25s ease'
    }}>
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #D4CFC6',
        background: run.status === 'failed' ? '#FEE2E2' : 'transparent',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1A1916' }}>
          {run.status === 'completed' ? 'Run finished' : run.status === 'failed' ? 'Run failed' : 'Starting run...'}
        </div>
        <Badge status={run.status === 'completed' ? 'completed' : run.status === 'failed' ? 'failed' : 'running'} pulse={run.status === 'running'} />
      </div>

      <div style={{ padding: '12px 16px' }}>
        {steps.map((s, idx) => {
          const status = stepStatuses[s.step_number.toString()] || 'pending';
          const isCurrent = status === 'waiting_for_human';
          
          return (
            <div key={idx}>
              <StepRow step={{
                step_number: s.step_number,
                name: s.name || s.objective.split('.')[0],
                step_type: s.step_type,
                status: status,
                output: run.global_state?.[`step_${s.step_number}_output`] || null
              }} isLast={idx === steps.length - 1} />
              
              {isCurrent && (
                <div style={{
                  background: '#FFFFFF',
                  border: '1px solid #C5D4F0',
                  borderRadius: '8px',
                  padding: '12px',
                  margin: '8px 0 8px 30px',
                  animation: 'fadeIn 0.2s ease'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#2E5BBA', marginBottom: '10px' }}>Your input is needed</div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    {['Looks good, proceed', 'Revise the tone'].map(pill => (
                      <button 
                        key={pill}
                        disabled={resumeLoading}
                        onClick={() => handleResume(pill === 'Looks good, proceed' ? undefined : pill)}
                        style={{
                          padding: '6px 14px', borderRadius: '100px', fontSize: '12px',
                          background: '#F7F6F3', border: '1px solid #D4CFC6', color: '#4A4845',
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#2E5BBA'; e.currentTarget.style.color = '#2E5BBA'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#D4CFC6'; e.currentTarget.style.color = '#4A4845'; }}
                      >
                        {pill}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <textarea 
                      id="checkpoint-input"
                      placeholder="Type instructions..."
                      style={{
                        flex: 1, height: '36px', padding: '8px 12px', border: '1px solid #D4CFC6', borderRadius: '8px',
                        fontSize: '12px', fontFamily: 'inherit', resize: 'none'
                      }}
                    />
                    <button 
                      onClick={() => {
                        const val = (document.getElementById('checkpoint-input') as HTMLTextAreaElement).value;
                        handleResume(val);
                      }}
                      style={{ background: '#1A1916', color: 'white', border: 'none', borderRadius: '8px', padding: '0 16px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MessageBubble = ({ message, isExpanded, onToggleRun }: { message: Message; isExpanded?: boolean; onToggleRun?: () => void }) => {
  const isAgent = message.role === 'agent';
  
  if (message.message_type === 'run_card') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', marginBottom: '12px' }}>
        <RunCard message={message} isExpanded={!!isExpanded} onToggle={onToggleRun || (() => {})} />
        <div style={{ fontSize: '11px', color: '#7A7770', alignSelf: 'flex-start', marginTop: '3px', marginBottom: '12px' }}>
          {formatTime(message.created_at)}
        </div>
      </div>
    );
  }

  if (message.message_type === 'memory_update') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignSelf: 'flex-start', marginBottom: '12px' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '6px 12px', background: '#EAF5EE', border: '1px solid #B8DFC8',
        borderRadius: '8px', fontSize: '12px', color: '#1A7A4A', fontWeight: 500
      }}>
        🧠 {message.content}
      </div>
      <div style={{ fontSize: '11px', color: '#7A7770', alignSelf: 'flex-start', marginTop: '3px', marginBottom: '12px' }}>
        {formatTime(message.created_at)}
      </div>
    </div>
  );

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignSelf: isAgent ? 'flex-start' : 'flex-end', 
      alignItems: isAgent ? 'flex-start' : 'flex-end',
      maxWidth: '72%', 
      marginBottom: '12px' 
    }}>
      <div style={{
        fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase',
        color: '#7A7770', marginBottom: '4px', textAlign: isAgent ? 'left' : 'right'
      }}>
        {isAgent ? 'AGENT' : 'YOU'}
      </div>
      <div style={{
        background: isAgent ? '#EEF2FB' : '#F0EEE9',
        border: isAgent ? '1px solid #C5D4F0' : '1px solid #D4CFC6',
        color: '#1A1916', padding: '11px 14px', borderRadius: '10px',
        fontSize: '13px', lineHeight: '1.55', whiteSpace: 'pre-line',
        display: isAgent ? 'block' : 'inline-block',
        textAlign: 'left'
      }}>
        {message.content}
      </div>
      <div style={{ 
        fontSize: '11px', color: '#7A7770', 
        marginTop: '3px'
      }}>
        {formatTime(message.created_at)}
      </div>
    </div>
  );
};

// --- Inner Page ---

function ConversationInner() {
  const { agentId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autorun = searchParams.get('autorun') === 'true';

  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);

  // Initial Fetch & Polling
  useEffect(() => {
    async function fetchData() {
      // 1. Fetch Agent
      const { data: agentData, error: agentErr } = await supabase.from('agents').select('*').eq('id', agentId).single();
      if (agentErr) console.error('Error fetching agent:', agentErr);
      if (agentData) setAgent(agentData);

      // 2. Fetch Messages
      const { data: msgData, error: msgErr } = await supabase.from('agent_conversations')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: true });
      if (msgErr) console.error('Error fetching messages:', msgErr);
      
      if (msgData) {
        setMessages(prev => {
          const merged = [...msgData];
          prev.forEach(p => {
            if (p.id.includes('.') && !merged.find(m => m.content === p.content && Math.abs(new Date(m.created_at).getTime() - new Date(p.created_at).getTime()) < 5000)) {
               merged.push(p);
            }
          });
          return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
      }

      // 3. Constant Recovery (if not already set)
      setActiveRunId(current => {
        if (!current) {
          supabase
            .from('agent_runs')
            .select('id')
            .eq('agent_id', agentId)
            .in('status', ['running', 'waiting_for_human'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data: activeRunData }) => {
              if (activeRunData) {
                setActiveRunId(activeRunData.id);
              }
            });
        }
        return current;
      });
    }

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [agentId]);

  // Handle Autorun
  useEffect(() => {
    if (autorun && agent && !activeRunId) {
      handleRunNow();
    }
  }, [autorun, agent]);

  // Auto-scroll
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeRunId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;
    const content = inputValue.trim().toLowerCase();
    
    if (content === 'run now') {
      handleRunNow();
      setInputValue('');
      return;
    }

    setIsSending(true);
    setInputValue('');
    
    // Optimistic UI
    const tempMsg: Message = {
      id: Math.random().toString(),
      agent_id: agentId as string,
      user_id: '',
      role: 'user',
      message_type: 'text',
      content: inputValue.trim(),
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/conversation/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ agent_id: agentId, content: inputValue.trim() })
      });
      const data = await res.json();
      if (data.intent === 'RUN_TRIGGER' && data.run_id) {
        setActiveRunId(data.run_id);
      }
    } catch (e) { console.error(e); }
    setIsSending(false);
  };

  const handleRunNow = async () => {
    if (agent?.status === 'running' || activeRunId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/runs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ agent_id: agentId })
      });
      if (res.ok) {
        const { run_id } = await res.json();
        setActiveRunId(run_id);
      }
    } catch (e) { console.error(e); }
  };

  const handlePause = async () => {
    if (!agent) return;
    const newStatus = agent.status === 'paused' ? 'active' : 'paused';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch(`/api/agents/${agentId}/pause`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) { console.error(e); }
  };

  const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({});

  // Group by day logic
  const threadElements = useMemo(() => {
    const elements: React.ReactNode[] = [];
    let lastDate = '';

    messages.forEach((msg) => {
      const date = new Date(msg.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      if (date !== lastDate) {
        elements.push(<DayDivider key={`divider-${msg.id}`} date={date} />);
        lastDate = date;
      }
      elements.push(
        <MessageBubble 
          key={msg.id} 
          message={msg} 
          isExpanded={expandedRuns[msg.id]} 
          onToggleRun={() => setExpandedRuns(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
        />
      );
    });

    const hasRunCardForActiveRun = messages.some(m => m.run_id === activeRunId && m.message_type === 'run_card');
    if (activeRunId && !hasRunCardForActiveRun) {
      elements.push(<LiveRunWidget key="live-run" runId={activeRunId} agentId={agentId as string} onComplete={() => setActiveRunId(null)} />);
    }

    if (elements.length === 0) {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
          <div style={{ fontSize: '14px', fontWeight: 500, color: '#7A7770', marginBottom: '8px' }}>No activity yet</div>
          <div style={{ fontSize: '12px', color: '#7A7770' }}>Send a message or click 'Run now' to get started.</div>
        </div>
      );
    }

    elements.push(<div key="bottom" ref={bottomRef} />);

    return elements;
  }, [messages, activeRunId, agentId, expandedRuns]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', height: '100vh', overflow: 'hidden', background: '#FFFFFF', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.9); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .spinner-mini {
          width: 10px; height: 10px; border: 2px solid rgba(46, 91, 186, 0.2); border-top: 2px solid #2E5BBA;
          border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>

      {/* Profile Panel Overlay */}
      {selectedAgentId && (
        <ProfilePanel agentId={selectedAgentId} onClose={() => setSelectedAgentId(null)} />
      )}

      {/* Chat Column */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', borderRight: '1px solid #D4CFC6' }}>
        {/* Header */}
        <header style={{ height: '56px', flexShrink: 0, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #D4CFC6', background: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px', background: '#1A1916', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: '14px', fontWeight: 600
            }}>
              {agent?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1A1916' }}>{agent?.name}</span>
              {agent && <Badge status={agent.status} pulse={agent.status === 'running'} />}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={handleRunNow}
              style={{ background: '#1A1916', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
            >
              Run now
            </button>
            <button 
              onClick={handlePause}
              style={{ background: '#FFFFFF', color: '#4A4845', border: '1px solid #D4CFC6', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
            >
              {agent?.status === 'paused' ? 'Resume' : 'Pause'}
            </button>
          </div>
        </header>

        {/* Thread */}
        <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0, background: '#F7F6F3', minHeight: 0 }}>
          {threadElements}
        </div>

        {/* Input area */}
        <div style={{ flexShrink: 0, padding: '12px 20px', borderTop: '1px solid #D4CFC6', background: '#FFFFFF', display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
          <textarea 
            value={inputValue}
            placeholder="Type a message, give feedback, or say 'run now'"
            onChange={(e) => {
              setInputValue(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            style={{
              flex: 1, minHeight: '40px', maxHeight: '120px', padding: '10px 14px',
              border: '1.5px solid #D4CFC6', borderRadius: '10px', fontSize: '13px',
              fontFamily: 'inherit', color: '#1A1916', resize: 'none', lineHeight: 1.5
            }}
          />
          <button 
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isSending}
            style={{
              width: '28px', height: '28px', background: '#1A1916', borderRadius: '7px',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', opacity: inputValue.trim() ? 1 : 0.3, transition: 'opacity 0.2s'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Profile Column */}
      <div style={{ height: '100vh', overflow: 'hidden' }}>
        <ProfilePanel agentId={agentId as string} inline />
      </div>
    </div>
  );
}

// --- Wrapper for Suspense ---

export default function AgentConversationPage() {
  return (
    <Suspense fallback={<div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F6F3', color: '#7A7770', fontSize: '13px' }}>Loading conversation...</div>}>
      <ConversationInner />
    </Suspense>
  );
}
