'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import ScoutChatPanel from '@/components/scout/ScoutChatPanel';
import BlueprintPanel from '@/components/scout/BlueprintPanel';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { AgentStep } from '@/components/scout/StepEditModal';

interface BlueprintJSON {
  agent_name: string;
  schedule: string;
  output_format: string;
  category: string;
  human_hours_per_run: number;
  steps: Array<{
    step_number: number;
    name: string;
    step_type: 'automated' | 'manual_review';
    objective: string;
    inputs: string;
    output_format: string;
    quality_rules: string;
    failure_conditions: string;
    loop_back_step_number: number | null;
  }>;
}

function CreatePageContent() {
  const router = useRouter();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [openingMessage, setOpeningMessage] = useState<string>('What should this agent do?');
  const [blueprint, setBlueprint] = useState<BlueprintJSON | null>(null);
  const [starting, setStarting] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    const startSession = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/signin');
          return;
        }

        const res = await fetch('/api/scout/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (body.error === 'no_api_key') {
            setStartError('No API key found. Please add your API key in Settings before hiring an agent.');
          } else {
            setStartError(body.error || 'Failed to start Scout session. Please try again.');
          }
          return;
        }

        const data = await res.json();
        setAgentId(data.agent_id);
        setOpeningMessage(data.opening_message || 'What should this agent do?');
      } catch {
        setStartError('Failed to start Scout session. Please check your connection and try again.');
      } finally {
        setStarting(false);
      }
    };

    startSession();
  }, [router]);

  const hasSteps = blueprint && blueprint.steps && blueprint.steps.length > 0;

  const handleBlueprintUpdated = useCallback((newBlueprint: BlueprintJSON) => {
    setBlueprint(newBlueprint);
  }, []);

  const handleStepUpdated = useCallback((updatedStep: AgentStep) => {
    setBlueprint(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: prev.steps.map(s =>
          s.step_number === updatedStep.step_number
            ? {
                ...s,
                name: updatedStep.name,
                step_type: updatedStep.step_type,
                objective: updatedStep.objective,
                inputs: updatedStep.inputs,
                output_format: updatedStep.output_format,
                quality_rules: updatedStep.quality_rules,
                failure_conditions: updatedStep.failure_conditions,
              }
            : s
        ),
      };
    });
  }, []);

  // Loading state
  if (starting) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <div style={{
          width: '20px',
          height: '20px',
          border: '2px solid var(--accent-light)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Starting Scout…</div>
      </div>
    );
  }

  // Error state
  if (startError || !agentId) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: '24px',
      }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '28px',
          maxWidth: '420px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '22px', marginBottom: '12px' }}>⚠️</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Could not start Scout
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
            {startError || 'An unknown error occurred.'}
          </div>
          <button
            id="create-page-retry-btn"
            onClick={() => { setStartError(null); setStarting(true); window.location.reload(); }}
            style={{
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#FFFFFF',
              background: '#1A1916',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      {/* Top Navigation Bar */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        height: '52px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            background: 'var(--text-primary)',
            borderRadius: '7px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg viewBox="0 0 18 18" fill="none" width="14" height="14">
              <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white"/>
              <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" opacity="0.6"/>
              <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.6"/>
              <rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.3"/>
            </svg>
          </div>
          <span style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
            Foreman
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            id="create-page-back-btn"
            onClick={() => router.push('/dashboard')}
            style={{
              padding: '7px 14px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ← Dashboard
          </button>
          <button
            id="create-page-review-btn"
            disabled={!hasSteps}
            onClick={() => router.push(`/review?agent_id=${agentId}`)}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#FFFFFF',
              background: '#1A1916',
              border: 'none',
              borderRadius: '8px',
              cursor: hasSteps ? 'pointer' : 'default',
              opacity: hasSteps ? 1 : 0.3,
              transition: 'opacity 0.15s',
            }}
          >
            Review &amp; Hire →
          </button>
        </div>
      </nav>

      {/* Split pane layout — 1fr 1fr, no sidebar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        flex: 1,
        overflow: 'hidden',
        height: 'calc(100vh - 52px)',
      }}>
        <ScoutChatPanel
          agentId={agentId}
          initialMessage={openingMessage}
          onBlueprintUpdated={handleBlueprintUpdated}
        />
        <BlueprintPanel
          agentId={agentId}
          blueprint={blueprint}
          onStepUpdated={handleStepUpdated}
        />
      </div>
    </div>
  );
}

export default function CreatePage() {
  return (
    <AuthGuard>
      <CreatePageContent />
    </AuthGuard>
  );
}
