'use client';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase';

export interface AgentStep {
  id: string;
  agent_id: string;
  step_number: number;
  name: string;
  step_type: 'automated' | 'manual_review';
  objective: string;
  inputs: string;
  output_format: string;
  quality_rules: string;
  failure_conditions: string;
  loop_back_step_number: number | null;
  created_at: string;
  updated_at: string;
}

interface StepEditModalProps {
  step: AgentStep;
  onSave: (updatedStep: AgentStep) => void;
  onClose: () => void;
}

export default function StepEditModal({ step, onSave, onClose }: StepEditModalProps) {
  const [name, setName] = useState(step.name);
  const [stepType, setStepType] = useState<'automated' | 'manual_review'>(step.step_type);
  const [objective, setObjective] = useState(step.objective);
  const [inputs, setInputs] = useState(step.inputs);
  const [outputFormat, setOutputFormat] = useState(step.output_format);
  const [qualityRules, setQualityRules] = useState(step.quality_rules);
  const [failureConditions, setFailureConditions] = useState(step.failure_conditions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch('/api/scout/step', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          step_id: step.id,
          updates: {
            name,
            step_type: stepType,
            objective,
            inputs,
            output_format: outputFormat,
            quality_rules: qualityRules,
            failure_conditions: failureConditions,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save step');
      }

      const { step: updatedStep } = await res.json();
      onSave(updatedStep);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    marginBottom: '5px',
    display: 'block',
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    border: '1.5px solid var(--border)',
    borderRadius: '8px',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    color: '#1A1916',
    background: '#FFFFFF',
    WebkitTextFillColor: '#1A1916',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: '72px',
    lineHeight: 1.5,
  };

  return (
    <div
      id="step-edit-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(26,25,22,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        id="step-edit-modal-card"
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 8px 40px rgba(0,0,0,0.13)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '15px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
              Step {step.step_number}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {name}
            </div>
          </div>
          <button
            id="step-edit-modal-close"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1,
            }}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '13px',
          overflowY: 'auto',
          flex: 1,
        }}>
          {/* Step name */}
          <div>
            <label htmlFor="modal-step-name" style={labelStyle}>Step name</label>
            <input
              id="modal-step-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1.5px solid var(--border)',
                borderRadius: '8px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                color: '#1A1916',
                background: '#FFFFFF',
                WebkitTextFillColor: '#1A1916',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Step type toggle */}
          <div>
            <span style={labelStyle}>Step type</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                id="modal-type-automated"
                onClick={() => setStepType('automated')}
                style={{
                  padding: '7px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  borderRadius: '8px',
                  border: stepType === 'automated' ? 'none' : '1.5px solid var(--border)',
                  background: stepType === 'automated' ? '#1A1916' : '#FFFFFF',
                  color: stepType === 'automated' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Automated
              </button>
              <button
                id="modal-type-manual"
                onClick={() => setStepType('manual_review')}
                style={{
                  padding: '7px 16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  borderRadius: '8px',
                  border: stepType === 'manual_review' ? 'none' : '1.5px solid var(--border)',
                  background: stepType === 'manual_review' ? '#1A1916' : '#FFFFFF',
                  color: stepType === 'manual_review' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Manual Review
              </button>
            </div>
          </div>

          {/* Objective */}
          <div>
            <label htmlFor="modal-objective" style={labelStyle}>Objective</label>
            <textarea
              id="modal-objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              style={textareaStyle}
            />
          </div>

          {/* Inputs */}
          <div>
            <label htmlFor="modal-inputs" style={labelStyle}>Inputs</label>
            <textarea
              id="modal-inputs"
              value={inputs}
              onChange={(e) => setInputs(e.target.value)}
              style={textareaStyle}
            />
          </div>

          {/* Output Format */}
          <div>
            <label htmlFor="modal-output-format" style={labelStyle}>Output Format</label>
            <textarea
              id="modal-output-format"
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              style={textareaStyle}
            />
          </div>

          {/* Quality Rules */}
          <div>
            <label htmlFor="modal-quality-rules" style={labelStyle}>Quality Rules</label>
            <textarea
              id="modal-quality-rules"
              value={qualityRules}
              onChange={(e) => setQualityRules(e.target.value)}
              style={textareaStyle}
            />
          </div>

          {/* Failure Conditions */}
          <div>
            <label htmlFor="modal-failure-conditions" style={labelStyle}>Failure Conditions</label>
            <textarea
              id="modal-failure-conditions"
              value={failureConditions}
              onChange={(e) => setFailureConditions(e.target.value)}
              style={textareaStyle}
            />
          </div>

          {error && (
            <div style={{
              background: 'var(--red-bg)',
              border: '1px solid var(--red-border)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '13px',
              color: 'var(--red)',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}>
          <button
            id="modal-cancel-btn"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              background: '#FFFFFF',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            id="modal-save-btn"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#FFFFFF',
              background: '#1A1916',
              border: 'none',
              borderRadius: '8px',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
