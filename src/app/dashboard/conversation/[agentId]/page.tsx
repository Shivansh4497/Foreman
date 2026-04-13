'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

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
  id: string;
  step_number: number;
  name: string;
  objective: string;
  step_type: 'auto' | 'review';
  is_checkpoint: boolean;
}

interface Run {
  id: string;
  status: string;
  created_at: string;
  metadata?: any;
}

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  message_type: 'text' | 'run_divider' | 'memory_update' | 'output' | 'checkpoint';
  created_at: string;
  metadata?: any;
}

export default function AgentConversationPage() {
  const { agentId } = useParams();
  const router = useRouter();
  
  // Chat State
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [waitingRunId, setWaitingRunId] = useState<string | null>(null);
  
  // Profile Panel State
  const [profileAgent, setProfileAgent] = useState<Agent | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [activeProfileTab, setActiveProfileTab] = useState<'memory' | 'workflow' | 'history'>('memory');
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1201);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Responsive Guard
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Initial Fetch & Chat Polling
  useEffect(() => {
    async function fetchInitialData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch agent
      const { data: agentData } = await supabase
        .from('agents')
        .select('id, name, status, total_runs')
        .eq('id', agentId as string)
        .single();

      if (agentData) {
        setAgent(agentData as Agent);
      }

      // Fetch message history
      const { data: msgData } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('agent_id', agentId as string)
        .order('created_at', { ascending: true });

      if (msgData) {
        setMessages(msgData as Message[]);
      }
      setIsRefreshing(false);
    }

    fetchInitialData();

    const interval = setInterval(async () => {
      // Fetch new messages
      const { data: newMsgs } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('agent_id', agentId as string)
        .order('created_at', { ascending: true });

      if (newMsgs) {
        setMessages(prev => {
          if (newMsgs.length !== prev.filter(m => m.message_type !== 'checkpoint').length) {
            const checkpoint = prev.find(m => m.message_type === 'checkpoint');
            return checkpoint ? [...newMsgs, checkpoint] : newMsgs;
          }
          return prev;
        });
      }

      // Fetch agent status
      const { data: agentData } = await supabase
        .from('agents')
        .select('id, name, status, total_runs')
        .eq('id', agentId as string)
        .single();

      if (agentData) {
        setAgent(agentData as Agent);
        if (agentData.status === 'waiting_for_human' || agentData.status === 'waiting') {
          const { data: runData } = await supabase
            .from('agent_runs')
            .select('id, status, global_state')
            .eq('agent_id', agentId as string)
            .eq('status', 'waiting_for_human')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (runData && runData.id !== waitingRunId) {
            setWaitingRunId(runData.id);
            setMessages(prev => {
              if (!prev.find(m => m.message_type === 'checkpoint' && m.metadata?.run_id === runData.id)) {
                const currentStep = runData.global_state?.current_step;
                const checkpointContent = runData.global_state?.[`step_${currentStep}_output`] || "Awaiting your review...";
                return [...prev, {
                  id: `checkpoint-${runData.id}`,
                  role: 'agent',
                  content: checkpointContent,
                  message_type: 'checkpoint',
                  created_at: new Date().toISOString(),
                  metadata: { run_id: runData.id, step: currentStep }
                } as Message];
              }
              return prev;
            });
          }
        } else {
          setWaitingRunId(null);
          setMessages(prev => prev.filter(m => m.message_type !== 'checkpoint' || m.metadata?.approved));
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [agentId, waitingRunId]);

  // Profile Data Fetching (Independent - 10s interval)
  useEffect(() => {
    async function fetchProfileData() {
      // 1. Fetch Agent (for memory and stats)
      const { data: agentData } = await supabase
        .from('agents')
        .select('id, name, status, schedule, total_runs, agent_memory, created_at, human_hours_per_run')
        .eq('id', agentId as string)
        .single();
      
      if (agentData) setProfileAgent(agentData as Agent);

      // 2. Fetch Steps
      const { data: stepsData } = await supabase
        .from('agent_steps')
        .select('*')
        .eq('agent_id', agentId as string)
        .order('step_number', { ascending: true });
      
      if (stepsData) setSteps(stepsData as Step[]);

      // 3. Fetch Runs (last 20)
      const { data: runsData } = await supabase
        .from('agent_runs')
        .select('id, status, created_at, metadata')
        .eq('agent_id', agentId as string)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (runsData) setRuns(runsData as Run[]);
    }

    fetchProfileData();
    const interval = setInterval(fetchProfileData, 10000);
    return () => clearInterval(interval);
  }, [agentId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSending) return;
    setIsSending(true);

    const content = inputValue.trim();
    setInputValue('');

    // Pre-inject message for responsiveness
    const tempMsg: Message = {
      id: Math.random().toString(),
      role: 'user',
      content,
      message_type: 'text',
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/conversation/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ agent_id: agentId, content })
      });

      if (!res.ok) throw new Error('Failed to send message');
      
      const result = await res.json();
      if (result.intent === 'RUN_TRIGGER' && result.run_id) {
        // Option handled by server: it will post run_divider and agent notification
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleResumeRun = async (runId: string, feedback?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/runs/resume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ run_id: runId, human_feedback: feedback })
      });

      if (res.ok) {
        // Mark checkpoint as approved
        setMessages(prev => prev.map(m => 
          (m.message_type === 'checkpoint' && m.metadata?.run_id === runId) 
            ? { ...m, content: '✓ Approved — continuing run...', metadata: { ...m.metadata, approved: true } }
            : m
        ));
        setWaitingRunId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePause = async () => {
    if (!agent) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const newStatus = agent.status === 'paused' ? 'active' : 'paused';
      const res = await fetch(`/api/agents/${agentId}/pause`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setAgent(prev => prev ? { ...prev, status: newStatus as any } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunNow = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/runs/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ agent_id: agentId })
      });
      if (res.ok) {
        const { run_id } = await res.json();
        router.push(`/dashboard/run/${run_id}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  function renderStatusBadge(status: string) {
    let bg = '#F0EEE9';
    let color = '#7A7770';
    let label = 'Unknown';
    let shouldPulse = false;

    switch (status.toLowerCase()) {
      case 'running':
        bg = '#EEF2FB';
        color = '#2E5BBA';
        label = 'Running';
        shouldPulse = true;
        break;
      case 'active':
        bg = '#EAF5EE';
        color = '#1A7A4A';
        label = 'Active';
        break;
      case 'waiting_for_human':
      case 'waiting':
        bg = '#FEF3DC';
        color = '#8A5C00';
        label = 'Waiting';
        break;
      case 'paused':
        bg = '#F0EEE9';
        color = '#7A7770';
        label = 'Paused';
        break;
      case 'failed':
        bg = '#FEE2E2';
        color = '#991B1B';
        label = 'Failed';
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
        <div style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: 'currentColor',
          animation: shouldPulse ? 'pulse 1.2s ease-in-out infinite' : undefined,
        }}></div>
        {label}
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: windowWidth < 1200 ? '1fr' : '1fr 300px',
      gridTemplateRows: '56px 1fr',
      height: '100vh', 
      background: '#FFFFFF',
      overflow: 'hidden'
    }}>
      {/* GLOBAL HEADER (Spans both columns) */}
      <header style={{
        gridColumn: windowWidth < 1200 ? '1' : '1 / span 2',
        height: '56px',
        background: '#FFFFFF',
        borderBottom: '1px solid #D4CFC6',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: '#1A1916',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 600,
            marginRight: '10px'
          }}>
            {agent?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1A1916' }}>{agent?.name || 'Loading...'}</span>
            {agent && <div style={{ marginLeft: '8px' }}>{renderStatusBadge(agent.status)}</div>}
          </div>
        </div>

        <div style={{ display: 'flex' }}>
          <button 
            onClick={handleRunNow}
            style={{
              background: '#1A1916',
              color: '#FFFFFF',
              padding: '7px 16px',
              fontSize: '13px',
              fontWeight: 500,
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Run now
          </button>
          <button 
            onClick={handlePause}
            style={{
              marginLeft: '8px',
              background: '#FFFFFF',
              border: '1px solid #D4CFC6',
              color: '#4A4845',
              padding: '7px 16px',
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            {agent?.status === 'paused' ? 'Resume' : 'Pause'}
          </button>
        </div>
      </header>

      {/* COLUMN 1: CHAT PANEL */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: 'calc(100vh - 56px)', 
        overflow: 'hidden',
        borderRight: windowWidth >= 1200 ? '1px solid #D4CFC6' : 'none'
      }}>
        {/* CHAT THREAD */}
        <div 
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            background: '#F7F6F3'
          }}
        >
          {isRefreshing && messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#7A7770', fontSize: '13px', marginTop: '40px' }}>Loading conversation...</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#7A7770', fontSize: '13px', marginTop: '40px' }}>No history yet. Start by saying hello!</div>
          ) : (
            messages.map((msg, idx) => {
              if (msg.message_type === 'run_divider') {
                return (
                  <div key={msg.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '14px 0' }}>
                    <div style={{ flex: 1, height: '1px', background: '#D4CFC6' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#7A7770' }}>{msg.content}</span>
                    <div style={{ flex: 1, height: '1px', background: '#D4CFC6' }} />
                  </div>
                );
              }

              if (msg.message_type === 'memory_update') {
                return (
                  <div key={msg.id} style={{ alignSelf: 'flex-start' }}>
                    <div style={{
                      background: '#EAF5EE',
                      border: '1px solid #B8DFC8',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      color: '#1A7A4A',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {msg.content}
                    </div>
                  </div>
                );
              }

              if (msg.message_type === 'checkpoint') {
                if (msg.metadata?.approved) {
                  return (
                    <div key={msg.id} style={{ alignSelf: 'flex-start' }}>
                       <div style={{ fontSize: '13px', color: '#1A7A4A', fontWeight: 500 }}>{msg.content}</div>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} style={{ 
                    alignSelf: 'stretch',
                    background: '#FFFFFF',
                    border: '1.5px solid #C5D4F0',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    margin: '10px 0'
                  }}>
                    <div style={{ padding: '10px 16px', background: '#EEF2FB', borderBottom: '1px solid #C5D4F0', fontSize: '12px', fontWeight: 600, color: '#2E5BBA' }}>
                      Awaiting Review
                    </div>
                    <div style={{ padding: '16px' }}>
                      <div style={{ fontSize: '13px', color: '#4A4845', lineHeight: 1.55, marginBottom: '20px', whiteSpace: 'pre-line' }}>
                        {msg.content}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                           <button 
                             onClick={() => handleResumeRun(msg.metadata?.run_id)}
                             style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 500, color: '#4A4845', background: '#F7F6F3', border: '1px solid #D4CFC6', borderRadius: '100px', cursor: 'pointer' }}
                           >
                             Approve as-is
                           </button>
                           <button 
                             style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 500, color: '#8A5C00', background: '#FEF3DC', border: '1px solid #F5D98A', borderRadius: '100px', cursor: 'pointer' }}
                           >
                             Search again
                           </button>
                        </div>
                        
                        <div style={{ position: 'relative' }}>
                          <textarea 
                            id={`feedback-${msg.id}`}
                            placeholder="Or give specific instructions to fix this..."
                            style={{
                              width: '100%',
                              padding: '10px 12px',
                              paddingRight: '40px',
                              border: '1px solid #D4CFC6',
                              borderRadius: '8px',
                              fontSize: '13px',
                              minHeight: '44px',
                              resize: 'none'
                            }}
                          />
                          <button 
                            onClick={() => {
                              const val = (document.getElementById(`feedback-${msg.id}`) as HTMLTextAreaElement).value;
                              handleResumeRun(msg.metadata?.run_id, val);
                            }}
                            style={{
                              position: 'absolute',
                              right: '8px',
                              bottom: '8px',
                              width: '28px',
                              height: '28px',
                              background: '#1A1916',
                              borderRadius: '7px',
                              border: 'none',
                              color: 'white',
                              cursor: 'pointer'
                            }}
                          >
                            →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              const isAgent = msg.role === 'agent';
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignSelf: isAgent ? 'flex-start' : 'flex-end', maxWidth: '88%' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: isAgent ? '#2E5BBA' : '#7A7770', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    {isAgent ? 'AGENT' : 'YOU'}
                  </div>
                  <div style={{
                    padding: '11px 14px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    lineHeight: 1.55,
                    background: isAgent ? (msg.message_type === 'output' ? '#F7F6F3' : '#EEF2FB') : '#F0EEE9',
                    border: isAgent ? (msg.message_type === 'output' ? '1px solid #D4CFC6' : '1px solid #C5D4F0') : '1px solid #D4CFC6',
                    color: '#1A1916',
                    whiteSpace: 'pre-line'
                  }}>
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* CHAT INPUT */}
        <div style={{
          background: '#FFFFFF',
          borderTop: '1px solid #D4CFC6',
          padding: '12px 16px',
          flexShrink: 0
        }}>
          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-end',
            maxWidth: '100%',
            position: 'relative'
          }}>
            <textarea 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message, give feedback, or say 'run now'"
              rows={1}
              style={{
                flex: 1,
                padding: '12px 16px',
                paddingRight: '50px',
                border: '1.5px solid #D4CFC6',
                borderRadius: '10px',
                background: '#FFFFFF',
                color: '#1A1916',
                fontSize: '13px',
                lineHeight: 1.5,
                resize: 'none',
                maxHeight: '120px'
              }}
            />
            <button 
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isSending}
              style={{
                position: 'absolute',
                right: '10px',
                bottom: '10px',
                width: '32px',
                height: '32px',
                background: '#1A1916',
                borderRadius: '7px',
                border: 'none',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                opacity: inputValue.trim() ? 1 : 0.3
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* COLUMN 3: PROFILE PANEL */}
      {windowWidth >= 1200 && (
        <div style={{ 
          width: '300px', 
          background: '#FFFFFF', 
          display: 'flex', 
          flexDirection: 'column',
          height: 'calc(100vh - 56px)', 
          overflow: 'hidden'
        }}>
          {/* PROFILE HEADER (Muted) */}
          {profileAgent?.schedule && (
            <div style={{ padding: '16px', borderBottom: '1px solid #D4CFC6', flexShrink: 0 }}>
              <div style={{ fontSize: '11px', color: '#7A7770' }}>
                {profileAgent.schedule}
              </div>
            </div>
          )}

          {/* STATS BAR */}
          {(() => {
            const totalRuns = profileAgent?.total_runs || 0;
            const timeSavedHours = ((profileAgent?.human_hours_per_run || 0) * totalRuns).toFixed(1);
            
            return (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr',
                gap: '8px', 
                padding: '12px 16px',
                borderBottom: '1px solid #D4CFC6',
                flexShrink: 0
              }}>
                {[
                  { label: 'Total runs', value: totalRuns },
                  { label: 'Time saved', value: `${timeSavedHours}h` },
                  { label: 'Total cost', value: '$0.00' },
                  { label: 'Avg run time', value: '14m' }
                ].map((stat, i) => (
                  <div key={i} style={{ background: '#F7F6F3', borderRadius: '8px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#1A1916', letterSpacing: '-0.2px' }}>{stat.value}</div>
                    <div style={{ 
                      fontSize: '10px', 
                      fontWeight: 600, 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.5px', 
                      color: '#7A7770', 
                      marginTop: '2px' 
                    }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* TABS */}
          <div style={{ display: 'flex', borderBottom: '1px solid #D4CFC6', padding: '0 16px', flexShrink: 0 }}>
            {(['memory', 'workflow', 'history'] as const).map(tab => (
              <div 
                key={tab}
                onClick={() => setActiveProfileTab(tab)}
                style={{
                  padding: '9px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: activeProfileTab === tab ? '#1A1916' : '#7A7770',
                  borderBottom: `2px solid ${activeProfileTab === tab ? '#1A1916' : 'transparent'}`,
                  marginBottom: '-1px',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {tab === 'history' ? 'Run History' : tab}
              </div>
            ))}
          </div>

          {/* TAB CONTENT */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {activeProfileTab === 'memory' && (
              <div>
                {!profileAgent?.agent_memory ? (
                  <div style={{ fontSize: '12px', color: '#7A7770', textAlign: 'center', marginTop: '24px' }}>
                    No memory yet. Run the agent and give feedback to start building memory.
                  </div>
                ) : (
                  profileAgent.agent_memory.split('\n').filter(line => line.trim()).slice(0, 20).map((line, i) => (
                    <div key={i} style={{ 
                      background: '#F7F6F3', 
                      border: '1px solid #D4CFC6', 
                      borderRadius: '8px',
                      padding: '8px 10px',
                      marginBottom: '6px',
                      fontSize: '12px',
                      color: '#1A1916',
                      lineHeight: 1.5
                    }}>
                      {line.replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, '')}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeProfileTab === 'workflow' && (
              <div>
                {steps.map((step, i) => (
                  <div key={step.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    padding: '9px 0',
                    borderBottom: i === steps.length - 1 ? 'none' : '1px solid #D4CFC6'
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: step.step_type === 'review' ? '#EEF2FB' : '#F0EEE9',
                      color: step.step_type === 'review' ? '#2E5BBA' : '#7A7770',
                      fontSize: '10px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {step.step_number}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#1A1916', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {step.name || step.objective?.substring(0, 40)}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: step.step_type === 'review' ? '#FEF3DC' : '#EAF5EE',
                      color: step.step_type === 'review' ? '#8A5C00' : '#1A7A4A',
                      textTransform: 'uppercase'
                    }}>
                      {step.step_type}
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#7A7770' }}>Schedule</span>
                    <span style={{ fontSize: '11px', fontWeight: 500, color: '#1A1916' }}>{profileAgent?.schedule || 'Manual'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', color: '#7A7770' }}>Provider</span>
                    <span style={{ fontSize: '11px', fontWeight: 500, color: '#1A1916' }}>OpenAI (gpt-4o)</span>
                  </div>
                </div>
              </div>
            )}

            {activeProfileTab === 'history' && (
              <div>
                {runs.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#7A7770', textAlign: 'center', marginTop: '24px' }}>No runs yet.</div>
                ) : (
                  runs.map((run, i) => (
                    <div 
                      key={run.id} 
                      onClick={() => router.push(`/dashboard/run/${run.id}`)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        padding: '8px 0',
                        borderBottom: i === runs.length - 1 ? 'none' : '1px solid #D4CFC6',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: run.status === 'completed' ? '#1A7A4A' : (run.status === 'failed' ? '#991B1B' : '#8A5C00'),
                        flexShrink: 0
                      }} />
                      <div style={{ fontSize: '12px', fontWeight: 500, color: '#1A1916' }}>Run #{runs.length - i}</div>
                      <div style={{ fontSize: '11px', color: '#7A7770' }}>
                        {new Date(run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '11px', color: '#7A7770', marginLeft: 'auto' }}>
                        $0.02
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
