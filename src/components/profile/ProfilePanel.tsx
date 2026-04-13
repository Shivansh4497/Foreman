'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import ProfileMemoryTab from './ProfileMemoryTab';
import ProfileWorkflowTab from './ProfileWorkflowTab';
import ProfileHistoryTab from './ProfileHistoryTab';

interface ProfileData {
  agent: {
    id: string;
    name: string;
    status: string;
    schedule: string;
    agent_memory: string;
    category: string;
    total_runs?: number;
    human_hours_per_run?: number;
  };
  steps: any[];
  runs: any[];
}

interface ProfilePanelProps {
  agentId: string;
  onClose?: () => void;
  inline?: boolean;
}

export default function ProfilePanel({ agentId, onClose, inline }: ProfilePanelProps) {
  const [activeTab, setActiveTab] = useState<'memory' | 'workflow' | 'history'>('memory');
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');

        const res = await fetch(`/api/agents/${agentId}/profile`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        if (!res.ok) throw new Error('Failed to fetch profile');
        
        const profileData = await res.json();
        setData(profileData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [agentId]);

  if (loading) {
    return (
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--surface)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        color: 'var(--text-tertiary)'
      }}>
        Loading profile...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--surface)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px'
      }}>
        <div style={{ color: 'var(--red)', fontSize: '13px' }}>{error || 'Profile not found'}</div>
        <button onClick={onClose} style={{
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          cursor: 'pointer'
        }}>
          Close
        </button>
      </div>
    );
  }

  const { agent, steps, runs } = data;

  // Format stats safely since API returns them on the agent object, not a separate stats object
  const totalRuns = agent.total_runs || 0;
  const avgRunTimeSec = (agent as any).avg_run_time || 0;
  const timeSavedHours = ((agent.human_hours_per_run || 0) * totalRuns).toFixed(1);
  
  const stats = {
    total_runs: totalRuns,
    total_time_saved: `${timeSavedHours}h`,
    total_cost: '$0.00',
    avg_run_time: avgRunTimeSec > 60 
      ? `${Math.floor(avgRunTimeSec / 60)}m ${Math.round(avgRunTimeSec % 60)}s` 
      : `${avgRunTimeSec}s`
  };

  const renderStatusDot = (status: string) => {
    let color = 'var(--text-tertiary)';
    if (status === 'active' || status === 'complete') color = 'var(--green)';
    if (status === 'running') color = 'var(--accent)';
    if (status === 'waiting' || status === 'waiting_for_human') color = 'var(--amber)';
    if (status === 'failed') color = 'var(--red)';

    return (
      <div style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
        marginRight: '6px',
        animation: status === 'running' ? 'pulse 1.2s ease-in-out infinite' : undefined
      }} />
    );
  };

  return (
    <div style={{
      position: inline ? 'relative' : 'absolute',
      inset: 0,
      background: 'var(--surface)',
      zIndex: inline ? 1 : 50,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflowX: 'hidden',
      overflowY: 'auto',
      borderLeft: inline ? '1px solid var(--border)' : 'none'
    }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {!inline && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0
        }}>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            ← Back
          </button>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-primary)'
          }}>
            {agent.name}
          </div>
          <div style={{ width: '48px' }} />
        </div>
      )}

      {!inline ? (
        <div style={{
          padding: '24px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '20px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'var(--text-primary)',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            color: 'white'
          }}>
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '20px',
              color: 'var(--text-primary)',
              marginBottom: '4px'
            }}>
              {agent.name}
            </h1>
            <div style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center'
            }}>
              {renderStatusDot(agent.status)}
              {agent.schedule || 'Manual trigger'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'white',
              background: 'var(--text-primary)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}>
              Run now
            </button>
            <button style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer'
            }}>
              {agent.status === 'paused' ? 'Resume' : 'Pause'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{agent.schedule || 'Manual trigger'}</div>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: inline ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: '10px',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        background: '#FFFFFF'
      }}>
        {[
          { label: 'Total runs', value: stats.total_runs },
          { label: 'Time saved', value: stats.total_time_saved },
          { label: 'Total cost', value: stats.total_cost },
          { label: 'Avg run time', value: stats.avg_run_time }
        ].map((stat, i) => (
          <div key={i} style={{
            background: '#F7F6F3',
            border: '1px solid #D4CFC6',
            borderRadius: '10px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#1A1916',
              letterSpacing: '-0.3px',
              lineHeight: 1.2
            }}>
              {stat.value}
            </div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              color: '#7A7770',
              marginTop: '4px'
            }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Tab Row */}
      <div style={{
        display: 'flex',
        gap: '24px',
        padding: '0 20px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0
      }}>
        {(['memory', 'workflow', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 0 10px',
              fontSize: '13px',
              fontWeight: 500,
              color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
              borderBottom: `2px solid ${activeTab === tab ? 'var(--text-primary)' : 'transparent'}`,
              background: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderTop: 'none',
              cursor: 'pointer',
              marginBottom: '-1px',
              textTransform: 'capitalize'
            }}
          >
            {tab === 'history' ? 'Run history' : tab}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ padding: '20px', flex: 1 }}>
        {activeTab === 'memory' && <ProfileMemoryTab memory={agent.agent_memory} />}
        {activeTab === 'workflow' && (
          <ProfileWorkflowTab 
            steps={steps} 
            agentId={agent.id} 
            onUpdate={() => {
              // Trigger a refresh if needed, though most updates are via modals
            }}
          />
        )}
        {activeTab === 'history' && <ProfileHistoryTab runs={runs} />}
      </div>
    </div>
  );
}
