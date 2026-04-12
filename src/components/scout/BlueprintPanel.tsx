'use client';
import { useState } from 'react';
import StepEditModal, { AgentStep } from './StepEditModal';

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

interface BlueprintPanelProps {
  agentId: string;
  blueprint: BlueprintJSON | null;
  onStepUpdated: (updatedStep: AgentStep) => void;
}

function LiveIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <style>{`
        @keyframes livepulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      <div style={{
        width: '5px',
        height: '5px',
        background: 'var(--green)',
        borderRadius: '50%',
        animation: 'livepulse 2s ease-in-out infinite',
      }} />
      <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--green)' }}>LIVE</span>
    </div>
  );
}

export default function BlueprintPanel({ agentId, blueprint, onStepUpdated }: BlueprintPanelProps) {
  const [editingStep, setEditingStep] = useState<AgentStep | null>(null);

  const handleStepSaved = (updatedStep: AgentStep) => {
    onStepUpdated(updatedStep);
    setEditingStep(null);
  };

  if (!blueprint) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: 'var(--bg)',
        padding: '24px',
      }}>
        <div style={{
          textAlign: 'center',
          maxWidth: '280px',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            margin: '0 auto 14px',
          }}>
            ⚡
          </div>
          <div style={{
            fontSize: '13px',
            color: 'var(--text-tertiary)',
            lineHeight: 1.6,
          }}>
            Blueprint builds here as you chat with Scout.
          </div>
        </div>
      </div>
    );
  }

  const steps = blueprint.steps || [];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg)',
      overflow: 'hidden',
    }}>
      {/* Panel header row */}
      <div
        id="blueprint-panel-header"
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: '16px',
          fontWeight: 400,
          color: 'var(--text-primary)',
          letterSpacing: '-0.2px',
        }}>
          {blueprint.agent_name}
        </div>
        <LiveIndicator />
      </div>

      {/* Meta bubbles row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '8px',
        padding: '10px 16px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {[
          { label: 'Schedule', value: blueprint.schedule || 'Manual only' },
          { label: 'Output', value: blueprint.output_format || '–' },
          { label: 'Steps', value: String(steps.length) },
        ].map((bubble) => (
          <div key={bubble.label} style={{
            padding: '8px 10px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
          }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              color: 'var(--text-tertiary)',
              marginBottom: '3px',
            }}>
              {bubble.label}
            </div>
            <div style={{
              fontSize: '13px',
              color: 'var(--text-primary)',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {bubble.value}
            </div>
          </div>
        ))}
      </div>

      {/* Steps list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '7px',
      }}>
        <style>{`
          @keyframes stepFadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        {steps.map((step) => {
          const isCheckpoint = step.step_type === 'manual_review';
          return (
            <div
              key={step.step_number}
              id={`blueprint-step-${step.step_number}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '11px 14px',
                background: 'var(--surface)',
                border: `1px solid ${isCheckpoint ? 'var(--accent-border)' : 'var(--border)'}`,
                borderRadius: '9px',
                animation: 'stepFadeIn 0.2s ease',
              }}
            >
              {/* Step number circle */}
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
                flexShrink: 0,
              }}>
                {step.step_number}
              </div>

              {/* Step name */}
              <div style={{
                flex: 1,
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-primary)',
              }}>
                {step.name}
              </div>

              {/* Tag badge */}
              <div style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: '4px',
                letterSpacing: '0.3px',
                textTransform: 'uppercase',
                background: isCheckpoint ? 'var(--amber-bg)' : 'var(--green-bg)',
                color: isCheckpoint ? 'var(--amber)' : 'var(--green)',
                flexShrink: 0,
              }}>
                {isCheckpoint ? 'Review' : 'Auto'}
              </div>

              {/* Edit button */}
              <button
                id={`blueprint-step-edit-${step.step_number}`}
                onClick={() => setEditingStep({
                  id: '', // will be fetched from real data in review page; here it's display-only
                  agent_id: agentId,
                  step_number: step.step_number,
                  name: step.name,
                  step_type: step.step_type,
                  objective: step.objective,
                  inputs: step.inputs,
                  output_format: step.output_format,
                  quality_rules: step.quality_rules,
                  failure_conditions: step.failure_conditions,
                  loop_back_step_number: step.loop_back_step_number,
                  created_at: '',
                  updated_at: '',
                })}
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
          );
        })}
      </div>

      {/* Step Edit Modal */}
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
