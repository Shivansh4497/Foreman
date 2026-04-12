'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Agent {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'running' | 'failed' | 'waiting' | 'draft' | 'waiting_for_human';
  schedule: string;
  category: string;
  total_runs: number;
  human_hours_per_run: number;
  updated_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('agents')
        .select('id, name, status, schedule, category, total_runs, human_hours_per_run, updated_at')
        .eq('user_id', user.id)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });

      if (data) {
        setAgents(data as Agent[]);
      }
      setLoading(false);
    }
    fetchAgents();
  }, []);

  const totalActive = agents.filter(a => a.status === 'active' || a.status === 'running').length;
  const runningNow = agents.filter(a => a.status === 'running').length;
  
  const totalRuns = agents.reduce((sum, a) => sum + (a.total_runs ?? 0), 0);
  const totalHoursSaved = agents.reduce((sum, a) => sum + ((a.human_hours_per_run ?? 0) * (a.total_runs ?? 0)), 0);

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
        label = 'Awaiting review';
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

  function getTimeSince(isoDate: string) {
    const d = new Date(isoDate);
    const now = new Date();
    const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return `${Math.floor(diffDays / 7)} weeks ago`;
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      
      {/* Page header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: loading || agents.length === 0 ? '32px' : '20px',
      }}>
        <h1 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: '22px',
          letterSpacing: '-0.4px',
          color: 'var(--text-primary)',
        }}>
          Your workforce
        </h1>
        <button
          onClick={() => router.push('/create')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#FFFFFF',
            background: '#1A1916',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.opacity = '0.85'; }}
          onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.opacity = '1'; }}
        >
          + Hire new agent
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
          Loading workforce...
        </div>
      ) : agents.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '380px',
          textAlign: 'center',
          gap: '14px',
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
          }}>
            ⚡
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}>
            No agents hired yet
          </div>
          <div style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            maxWidth: '300px',
          }}>
            Tell Scout what you need. Scout will design the workflow, set the schedule, and put your first agent to work.
          </div>
          <button
            onClick={() => router.push('/create')}
            style={{
              padding: '11px 22px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#FFFFFF',
              background: '#1A1916',
              border: 'none',
              borderRadius: '9px',
              cursor: 'pointer',
              marginTop: '4px',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.opacity = '0.85'; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.opacity = '1'; }}
          >
            + Hire your first agent
          </button>
        </div>
      ) : (
        <>
          {/* STATS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px',
            marginBottom: '18px',
          }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #D4CFC6', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7A7770', marginBottom: '4px' }}>Agents active</div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: '#1A1916', letterSpacing: '-0.3px' }}>{totalActive}</div>
              <div style={{ fontSize: '11px', color: '#7A7770', marginTop: '1px' }}>{runningNow} running now</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #D4CFC6', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7A7770', marginBottom: '4px' }}>Hours saved</div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: '#1A1916', letterSpacing: '-0.3px' }}>{Math.round(totalHoursSaved * 10) / 10}h</div>
              <div style={{ fontSize: '11px', color: '#7A7770', marginTop: '1px' }}>this month</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #D4CFC6', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7A7770', marginBottom: '4px' }}>Total runs</div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: '#1A1916', letterSpacing: '-0.3px' }}>{totalRuns}</div>
              <div style={{ fontSize: '11px', color: '#7A7770', marginTop: '1px' }}>last 30 days</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #D4CFC6', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7A7770', marginBottom: '4px' }}>API cost</div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: '#1A1916', letterSpacing: '-0.3px' }}>$0.00</div>
              <div style={{ fontSize: '11px', color: '#7A7770', marginTop: '1px' }}>this month</div>
            </div>
          </div>

          {/* AGENT CARDS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}>
            {agents.map((agent) => {
              const requiresAttention = agent.status === 'waiting' || agent.status === 'waiting_for_human';
              
              return (
                <div key={agent.id} style={{
                  background: '#FFFFFF',
                  border: requiresAttention ? '1.5px solid #C5D4F0' : '1px solid #D4CFC6',
                  borderRadius: '12px',
                  padding: '18px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1916', marginBottom: '2px' }}>
                        {agent.name || 'Unnamed Agent'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#7A7770' }}>
                        {agent.schedule || 'Manual trigger'}
                      </div>
                    </div>
                    {renderStatusBadge(agent.status)}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '7px', marginBottom: '14px' }}>
                    <div style={{ background: '#F7F6F3', borderRadius: '7px', padding: '9px', textAlign: 'center' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1916' }}>{agent.total_runs}</div>
                      <div style={{ fontSize: '10px', color: '#7A7770', marginTop: '1px' }}>Total runs</div>
                    </div>
                    <div style={{ background: '#F7F6F3', borderRadius: '7px', padding: '9px', textAlign: 'center' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1916' }}>
                        {Math.round((agent.human_hours_per_run ?? 0) * (agent.total_runs ?? 0) * 10) / 10}h
                      </div>
                      <div style={{ fontSize: '10px', color: '#7A7770', marginTop: '1px' }}>Time saved</div>
                    </div>
                    <div style={{ background: '#F7F6F3', borderRadius: '7px', padding: '9px', textAlign: 'center' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1916' }}>$0.00</div>
                      <div style={{ fontSize: '10px', color: '#7A7770', marginTop: '1px' }}>API cost</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '11px', color: '#7A7770' }}>
                      {agent.status === 'running' ? 'Running now' : 
                       requiresAttention ? `Checkpoint waiting — ${getTimeSince(agent.updated_at)}` 
                       : `Last run: ${getTimeSince(agent.updated_at)}`}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button style={{
                        padding: '5px 11px',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: '#4A4845',
                        background: '#FFFFFF',
                        border: '1px solid #D4CFC6',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}>
                        Edit
                      </button>
                      
                      {agent.status === 'running' ? (
                        <button style={{
                          padding: '5px 11px', fontSize: '11px', fontWeight: 500, color: '#4A4845', background: '#FFFFFF', border: '1px solid #D4CFC6', borderRadius: '6px', cursor: 'pointer'
                        }}>
                          View run
                        </button>
                      ) : requiresAttention ? (
                        <button style={{
                          padding: '5px 11px', fontSize: '11px', fontWeight: 500, color: '#FFFFFF', background: '#1A1916', border: 'none', borderRadius: '6px', cursor: 'pointer'
                        }}>
                          Review →
                        </button>
                      ) : agent.status === 'paused' ? (
                        <button style={{
                          padding: '5px 11px', fontSize: '11px', fontWeight: 500, color: '#FFFFFF', background: '#1A1916', border: 'none', borderRadius: '6px', cursor: 'pointer'
                        }}>
                          Resume
                        </button>
                      ) : (
                        <button 
                          onClick={async () => {
                            const res = await fetch('/api/runs/start', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                              },
                              body: JSON.stringify({ agent_id: agent.id })
                            });
                            if (res.ok) {
                              const { run_id } = await res.json();
                              router.push(`/dashboard/run/${run_id}`);
                            }
                          }}
                          style={{
                          padding: '5px 11px', fontSize: '11px', fontWeight: 500, color: '#FFFFFF', background: '#1A1916', border: 'none', borderRadius: '6px', cursor: 'pointer'
                        }}>
                          Run now
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
