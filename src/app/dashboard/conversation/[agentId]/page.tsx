'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import ProfilePanel from '@/components/profile/ProfilePanel';

interface Agent {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'running' | 'failed' | 'waiting' | 'waiting_for_human';
  total_runs: number;
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
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [waitingRunId, setWaitingRunId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Initial fetch
  useEffect(() => {
    async function fetchData() {
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

    fetchData();
  }, [agentId]);

  // Polling every 3 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      // 1. Fetch new messages
      const { data: newMsgs } = await supabase
        .from('agent_conversations')
        .select('*')
        .eq('agent_id', agentId as string)
        .order('created_at', { ascending: true });

      if (newMsgs) {
        setMessages(prev => {
          // Compare lengths or check for new IDs to avoid unnecessary state updates
          if (newMsgs.length !== prev.filter(m => m.message_type !== 'checkpoint').length) {
            // Merge in checkpoint if any
            const checkpoint = prev.find(m => m.message_type === 'checkpoint');
            if (checkpoint) {
              return [...newMsgs, checkpoint];
            }
            return newMsgs;
          }
          return prev;
        });
      }

      // 2. Fetch agent status and runs
      const { data: agentData } = await supabase
        .from('agents')
        .select('id, name, status, total_runs')
        .eq('id', agentId as string)
        .single();

      if (agentData) {
        setAgent(agentData as Agent);

        // Check for waiting runs
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
            // Inject checkpoint message if not already there
            setMessages(prev => {
              if (!prev.find(m => m.message_type === 'checkpoint' && m.metadata?.run_id === runData.id)) {
                const currentStep = runData.global_state?.current_step;
                const checkpointContent = runData.global_state?.[`step_${currentStep}_output`] || "Awaiting your review...";
                
                const checkpointMsg: Message = {
                  id: `checkpoint-${runData.id}`,
                  role: 'agent',
                  content: checkpointContent,
                  message_type: 'checkpoint',
                  created_at: new Date().toISOString(),
                  metadata: { run_id: runData.id, step: currentStep }
                };
                return [...prev, checkpointMsg];
              }
              return prev;
            });
          }
        } else {
          setWaitingRunId(null);
          // Remove checkpoint if run is no longer waiting
          setMessages(prev => prev.filter(m => m.message_type !== 'checkpoint' || m.metadata?.approved));
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [agentId, waitingRunId]);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#FFFFFF', position: 'relative' }}>
      {isProfileOpen && agent && (
        <ProfilePanel 
          agentId={agent.id} 
          onClose={() => setIsProfileOpen(false)} 
        />
      )}
      
      {/* HEADER */}
      <header style={{
        height: '60px',
        borderBottom: '1px solid #D4CFC6',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        background: '#FFFFFF',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div 
            onClick={() => setIsProfileOpen(true)}
            style={{
              width: '28px',
              height: '28px',
              background: '#1A1916',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {agent?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div 
             onClick={() => setIsProfileOpen(true)}
             style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1A1916' }}>{agent?.name || 'Loading...'}</span>
            {agent && renderStatusBadge(agent.status)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={handleRunNow}
            style={{
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#FFFFFF',
              background: '#1A1916',
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
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#4A4845',
              background: '#FFFFFF',
              border: '1px solid #D4CFC6',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            {agent?.status === 'paused' ? 'Resume' : 'Pause'}
          </button>
        </div>
      </header>

      {/* THREAD */}
      <div 
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          background: '#FFFFFF'
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

      {/* INPUT */}
      <div style={{
        background: '#F7F6F3',
        borderTop: '1px solid #D4CFC6',
        padding: '12px 20px',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-end',
          maxWidth: '800px',
          margin: '0 auto',
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

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
