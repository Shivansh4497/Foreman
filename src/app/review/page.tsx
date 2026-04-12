'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import StepEditModal, { AgentStep } from '@/components/scout/StepEditModal';
import { createSupabaseBrowserClient } from '@/lib/supabase';

interface AgentMeta {
  name: string | null;
  schedule: string | null;
  category: string | null;
}

function ReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentId = searchParams.get('agent_id');

  const [agent, setAgent] = useState<AgentMeta | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<AgentStep | null>(null);
  const [hiring, setHiring] = useState(false);
  const [hireError, setHireError] = useState<string | null>(null);

  const fetchBlueprint = useCallback(async () => {
    if (!agentId) {
      setLoadError('No agent ID provided. Please go back to the create page.');
      setLoading(false);
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/signin');
        return;
      }

      const res = await fetch(`/api/scout/blueprint?agent_id=${agentId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load blueprint');
      }

      const data = await res.json();
      setAgent(data.agent);
      setSteps(data.steps || []);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load blueprint');
    } finally {
      setLoading(false);
    }
  }, [agentId, router]);

  useEffect(() => { fetchBlueprint(); }, [fetchBlueprint]);

  const handleStepSaved = useCallback((updatedStep: AgentStep) => {
    setSteps(prev => prev.map(s => s.id === updatedStep.id ? updatedStep : s));
    setEditingStep(null);
  }, []);

  const handleHire = async () => {
    setHiring(true);
    setHireError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch('/api/scout/hire', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ agent_id: agentId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to hire agent');
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      setHireError(err instanceof Error ? err.message : 'Failed to hire agent');
    } finally {
      setHiring(false);
    }
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    color: 'var(--text-tertiary)',
    marginBottom: '4px',
    display: 'block',
  };

  const fieldValueStyle: React.CSSProperties = {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60vh',
          gap: '12px',
        }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid var(--accent-light)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Loading blueprint…</div>
        </div>
      );
    }

    if (loadError) {
      return (
        <div style={{
          background: 'var(--red-bg)',
          border: '1px solid var(--red-border)',
          borderRadius: '10px',
          padding: '20px',
          marginTop: '24px',
          fontSize: '13px',
          color: 'var(--red)',
        }}>
          {loadError}
        </div>
      );
    }

    return (
      <>
        {/* Agent metadata card */}
        {agent && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}>
            <div>
              <span style={fieldLabelStyle}>Agent name</span>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {agent.name || 'Unnamed agent'}
              </div>
            </div>
            <div>
              <span style={fieldLabelStyle}>Schedule</span>
              <div style={fieldValueStyle}>{agent.schedule || 'Manual only'}</div>
            </div>
            <div>
              <span style={fieldLabelStyle}>Category</span>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 10px',
                background: 'var(--accent-light)',
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--accent)',
              }}>
                {agent.category || 'Custom'}
              </div>
            </div>
          </div>
        )}

        {/* Steps */}
        {steps.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '48px 24px',
            color: 'var(--text-tertiary)',
            fontSize: '13px',
          }}>
            No steps found. Go back to the create page and chat with Scout to build the blueprint.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
            {steps.map((step) => {
              const isCheckpoint = step.step_type === 'manual_review';
              return (
                <div
                  key={step.id}
                  id={`review-step-${step.step_number}`}
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${isCheckpoint ? 'var(--accent-border)' : 'var(--border)'}`,
                    borderRadius: '10px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Step header row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    background: isCheckpoint ? 'var(--accent-light)' : 'var(--surface)',
                  }}>
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: isCheckpoint ? 'var(--accent-light)' : 'var(--surface2)',
                      color: isCheckpoint ? 'var(--accent)' : 'var(--text-tertiary)',
                      fontSize: '11px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: isCheckpoint ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                      flexShrink: 0,
                    }}>
                      {step.step_number}
                    </div>
                    <div style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {step.name}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      letterSpacing: '0.3px',
                      textTransform: 'uppercase',
                      background: isCheckpoint ? 'var(--amber-bg)' : 'var(--green-bg)',
                      color: isCheckpoint ? 'var(--amber)' : 'var(--green)',
                    }}>
                      {isCheckpoint ? 'Manual Review' : 'Automated'}
                    </div>
                    <button
                      id={`review-step-edit-${step.step_number}`}
                      onClick={() => setEditingStep(step)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '26px',
                        padding: '0 11px',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'border-color 0.15s, color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLButtonElement).style.borderColor = 'var(--accent)';
                        (e.target as HTMLButtonElement).style.color = 'var(--accent)';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLButtonElement).style.borderColor = 'var(--border)';
                        (e.target as HTMLButtonElement).style.color = 'var(--text-secondary)';
                      }}
                    >
                      Edit
                    </button>
                  </div>

                  {/* Step fields */}
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { label: 'Objective', value: step.objective },
                      { label: 'Inputs', value: step.inputs },
                      { label: 'Output Format', value: step.output_format },
                      { label: 'Quality Rules', value: step.quality_rules },
                      { label: 'Failure Conditions', value: step.failure_conditions },
                    ].map((field) => (
                      <div key={field.label}>
                        <span style={fieldLabelStyle}>{field.label}</span>
                        <div style={{
                          ...fieldValueStyle,
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '9px 12px',
                          whiteSpace: 'pre-wrap',
                        }}>
                          {field.value || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Not specified</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Hire button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          {hireError && (
            <div style={{
              background: 'var(--red-bg)',
              border: '1px solid var(--red-border)',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '13px',
              color: 'var(--red)',
              width: '100%',
            }}>
              {hireError}
            </div>
          )}
          <button
            id="review-hire-btn"
            onClick={handleHire}
            disabled={hiring || steps.length === 0}
            style={{
              padding: '12px 28px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#FFFFFF',
              background: '#1A1916',
              border: 'none',
              borderRadius: '9px',
              cursor: hiring || steps.length === 0 ? 'default' : 'pointer',
              opacity: hiring || steps.length === 0 ? 0.4 : 1,
              transition: 'opacity 0.15s',
              alignSelf: 'flex-end',
            }}
          >
            {hiring ? 'Hiring agent…' : 'Hire Agent →'}
          </button>
        </div>
      </>
    );
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '200px 1fr',
      minHeight: '100vh',
      background: 'var(--bg)',
    }}>
      <Sidebar />
      <main style={{ padding: '28px', overflowY: 'auto' }}>
        <h1 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: '24px',
          letterSpacing: '-0.4px',
          color: 'var(--text-primary)',
          marginBottom: '6px',
        }}>
          Review your agent
        </h1>
        <p style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: '24px',
        }}>
          Review every step before hiring. You can edit any step here.
        </p>

        {renderContent()}
      </main>

      {editingStep && (
        <StepEditModal
          step={editingStep}
          onSave={handleStepSaved}
          onClose={() => setEditingStep(null)}
        />
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <AuthGuard>
      <Suspense fallback={
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Loading…</div>
        </div>
      }>
        <ReviewPageContent />
      </Suspense>
    </AuthGuard>
  );
}
