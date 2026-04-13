'use client';

import { useState } from 'react';
import StepEditModal, { AgentStep } from '@/components/scout/StepEditModal';

interface ProfileWorkflowTabProps {
  steps: AgentStep[];
  agentId: string;
  onUpdate?: () => void;
}

export default function ProfileWorkflowTab({ steps, agentId, onUpdate }: ProfileWorkflowTabProps) {
  const [editingStep, setEditingStep] = useState<AgentStep | null>(null);
  const [localSteps, setLocalSteps] = useState<AgentStep[]>(steps);

  const handleStepSave = (updatedStep: AgentStep) => {
    setLocalSteps(prev => prev.map(s => s.id === updatedStep.id ? updatedStep : s));
    setEditingStep(null);
    if (onUpdate) onUpdate();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {localSteps.map((step) => (
          <div key={step.id} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 14px',
            background: 'var(--surface)',
            border: `1px solid ${step.step_type === 'manual_review' ? 'var(--accent-border)' : 'var(--border)'}`,
            borderRadius: '9px'
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: step.step_type === 'manual_review' ? 'var(--accent-light)' : 'var(--surface2)',
              color: step.step_type === 'manual_review' ? 'var(--accent)' : 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 600,
              flexShrink: 0
            }}>
              {step.step_number}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {step.name}
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase',
                  background: step.step_type === 'automated' ? 'var(--green-bg)' : 'var(--amber-bg)',
                  color: step.step_type === 'automated' ? 'var(--green)' : 'var(--amber)'
                }}>
                  {step.step_type === 'automated' ? 'AUTO' : 'REVIEW'}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setEditingStep(step)}
              style={{
                height: '26px',
                padding: '0 11px',
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Edit
            </button>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: '12px',
        padding: '20px',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--text-tertiary)',
              marginBottom: '8px'
            }}>
              Schedule
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                flex: 1,
                padding: '9px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '13px',
                color: 'var(--text-primary)'
              }}>
                Regularly
              </div>
              <button style={{
                fontSize: '12px',
                color: 'var(--accent)',
                fontWeight: 500,
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}>
                Edit
              </button>
            </div>
          </div>
          <div>
            <label style={{
              display: 'block',
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--text-tertiary)',
              marginBottom: '8px'
            }}>
              Provider
            </label>
            <div style={{
              padding: '9px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              opacity: 0.7
            }}>
              OpenAI (GPT-4o)
            </div>
          </div>
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--text-tertiary)',
          fontStyle: 'italic'
        }}>
          Changes apply from next run
        </div>
      </div>

      {editingStep && (
        <StepEditModal 
          step={editingStep} 
          onSave={handleStepSave} 
          onClose={() => setEditingStep(null)} 
        />
      )}
    </div>
  );
}
