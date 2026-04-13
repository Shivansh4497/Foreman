'use client';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function RunExecutionPage() {
  const router = useRouter();
  const params = useParams();
  const runId = typeof params.id === 'string' ? params.id : '';

  const [agentRuns, setAgentRuns] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [humanInput, setHumanInput] = useState('');
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  const toggleStep = (stepNumber: string) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepNumber]: !prev[stepNumber]
    }));
  };

  const cleanOutput = (raw: string): string => {
    // Strip markdown code fences: ```json ... ``` or ``` ... ```
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
    // Also strip leading/trailing backtick-json if single line
    cleaned = cleaned.replace(/^`json\s*/i, '');
    cleaned = cleaned.replace(/`\s*$/i, '');
    return cleaned.trim();
  };

  const renderOutput = (output: any) => {
    if (!output) return null;
    
    let parsed: any;
    try {
      const cleaned = typeof output === 'string' ? cleanOutput(output) : output;
      parsed = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned;
    } catch (e) {
      return <p style={{ margin: 0 }}>{String(output)}</p>;
    }

    // 1. If result has "chat_bubble_format" or "post_draft" -> return the value as a <p> tag
    if (parsed && typeof parsed === 'object' && (parsed.chat_bubble_format || parsed.post_draft)) {
      const displayValue = parsed.chat_bubble_format || parsed.post_draft;
      return (
        <p style={{ margin: 0, lineHeight: '1.6' }}>
          {displayValue}
        </p>
      );
    }

    // 2. If result has "topic_sources" array
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.topic_sources)) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {parsed.topic_sources.map((ts: any, idx: number) => (
            <div key={idx}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#1A1916', marginBottom: '4px' }}>
                {ts.topic}
              </div>
              {Array.isArray(ts.sources) && (
                <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc' }}>
                  {ts.sources.map((s: any, sIdx: number) => (
                    <li key={sIdx} style={{ fontSize: '12px', color: '#4A4845', lineHeight: '1.6' }}>
                      {s.summary}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      );
    }

    // 3. If result has "steps" array
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.steps)) {
      return (
        <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc' }}>
          {parsed.steps.map((step: any, idx: number) => (
            <li key={idx} style={{ fontSize: '12px', color: '#4A4845', lineHeight: '1.6' }}>
              {typeof step === 'string' ? step : (step.name || step.title || JSON.stringify(step))}
            </li>
          ))}
        </ul>
      );
    }

    // 4. If result is an array -> render each item's first string value as a bullet
    if (Array.isArray(parsed)) {
      return (
        <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc' }}>
          {parsed.map((item: any, idx: number) => {
            let val = '';
            if (typeof item === 'string') val = item;
            else if (item && typeof item === 'object') {
              val = Object.values(item).find(v => typeof v === 'string') as string || JSON.stringify(item);
            }
            return (
              <li key={idx} style={{ fontSize: '12px', color: '#4A4845', lineHeight: '1.6' }}>
                {val}
              </li>
            );
          })}
        </ul>
      );
    }

    // 5. If result is an object with string values -> render as key: value lines
    if (parsed && typeof parsed === 'object') {
      const stringEntries = Object.entries(parsed).filter(([_, v]) => typeof v === 'string');
      if (stringEntries.length > 0) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {stringEntries.map(([key, value]) => (
              <div key={key} style={{ fontSize: '12px', color: '#4A4845', lineHeight: '1.6' }}>
                <span style={{ fontWeight: 600, color: '#1A1916', marginRight: '4px' }}>{key.replace(/_/g, ' ')}:</span>
                {String(value)}
              </div>
            ))}
          </div>
        );
      }

      // 6. Fallback -> render first 3 string values found anywhere in the object
      const foundStrings: string[] = [];
      const findStrings = (obj: any) => {
        if (foundStrings.length >= 3) return;
        if (!obj || typeof obj !== 'object') return;
        for (const val of Object.values(obj)) {
          if (typeof val === 'string' && val.length > 5 && !val.includes('http')) {
            foundStrings.push(val);
          } else if (val && typeof val === 'object') {
            findStrings(val);
          }
          if (foundStrings.length >= 3) return;
        }
      };
      findStrings(parsed);
      if (foundStrings.length > 0) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {foundStrings.map((s, i) => <p key={i} style={{ margin: 0, fontSize: '12px', color: '#4A4845', lineHeight: '1.6' }}>{s}</p>)}
          </div>
        );
      }
    }

    return <p style={{ margin: 0 }}>{String(output)}</p>;
  };

  // Setup loop
  useEffect(() => {
    if (!runId) return;
    
    let interval: NodeJS.Timeout;

    async function fetchRunState() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: run, error: runErr } = await supabase
        .from('agent_runs')
        .select('*, agents(name)')
        .eq('id', runId)
        .eq('user_id', user.id)
        .single();
        
      if (runErr || !run) {
        if (!agentRuns) setLoading(false);
        return;
      }
      setAgentRuns(run);

      // Only fetch steps once
      if (steps.length === 0) {
        const { data: s } = await supabase
          .from('agent_steps')
          .select('*')
          .eq('agent_id', run.agent_id)
          .order('step_number', { ascending: true });
        if (s) setSteps(s);
      }
      setLoading(false);
    }

    fetchRunState(); // Instant fetch
    interval = setInterval(fetchRunState, 3000); // Poll every 3 seconds per PRD

    return () => clearInterval(interval);
  }, [runId, steps.length, agentRuns]);

  const handleResume = async (quickReply?: string) => {
    setSubmitting(true);
    const feedback = quickReply || humanInput;
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
      setHumanInput('');
      // Force instant UI refresh before next poll interval
      const { data: refreshRun } = await supabase.from('agent_runs').select('*').eq('id', runId).single();
      if (refreshRun) setAgentRuns(refreshRun);
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div style={{ padding: '40px', color: 'var(--text-tertiary)', fontSize: '13px', textAlign: 'center' }}>Connecting to Agent Execute Sequence...</div>;
  }

  if (!agentRuns) {
    return <div style={{ padding: '40px', color: 'var(--red)', fontSize: '13px' }}>Run execution trace not found. Valid IDs only.</div>;
  }

  const state = agentRuns.global_state || {};
  const stepStatuses = state.step_statuses || {};
  
  return (
    <div style={{ padding: '24px 28px', maxWidth: '800px', margin: '0 auto' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px', letterSpacing: '-0.4px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            {agentRuns.agents?.name || 'Unnamed Agent'} Run
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Status: <strong style={{color: 'var(--accent)'}}>{agentRuns.status.toUpperCase()}</strong>
          </div>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, color: '#4A4845', background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer' }}
        >
          Close view
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {steps.map((step) => {
          const stepStatus = stepStatuses[step.step_number.toString()] || 'pending';
          const output = state[`step_${step.step_number}_output`];
          
          let circleBg = '#F0EEE9';
          let circleColor = '#7A7770';
          let borderStyle = '1px solid var(--border)';
          
          if (stepStatus === 'running') {
            circleBg = '#EEF2FB';
            circleColor = '#2E5BBA';
            borderStyle = '1.5px solid var(--accent-border)';
          } else if (stepStatus === 'completed') {
            circleBg = '#EAF5EE';
            circleColor = '#1A7A4A';
          } else if (stepStatus === 'waiting_for_human') {
            circleBg = '#FEF3DC';
            circleColor = '#8A5C00';
            borderStyle = '1.5px solid var(--amber-border)';
          } else if (stepStatus === 'failed') {
            circleBg = '#FEE2E2';
            circleColor = '#991B1B';
            borderStyle = '1.5px solid var(--red-border)';
          }

          return (
            <div key={step.id} style={{ display: 'flex', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: circleBg, color: circleColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 600,
                  border: stepStatus === 'running' ? '2px solid #2E5BBA' : 'none',
                  borderTopColor: stepStatus === 'running' ? 'transparent' : undefined,
                  animation: stepStatus === 'running' ? 'spin 1s linear infinite' : undefined,
                }}>
                  {stepStatus === 'running' ? '' : stepStatus === 'completed' ? '✓' : stepStatus === 'failed' ? '✕' : step.step_number}
                </div>
                {step.step_number < steps.length && (
                  <div style={{ width: '2px', flex: 1, background: stepStatus === 'completed' ? 'var(--green-border)' : '#E0DCD6', margin: '4px 0' }}></div>
                )}
              </div>
              
              <div style={{ flex: 1, paddingBottom: step.step_number < steps.length ? '20px' : '0' }}>
                <div style={{ background: '#FFFFFF', border: borderStyle, borderRadius: '10px', overflow: 'hidden' }}>
                  
                  {/* Step Header */}
                  <div 
                    onClick={() => toggleStep(step.step_number.toString())}
                    style={{ 
                      padding: '12px 16px', 
                      background: stepStatus === 'waiting_for_human' ? 'var(--amber-bg)' : stepStatus === 'running' ? 'var(--accent-light)' : 'transparent', 
                      borderBottom: (expandedSteps[step.step_number.toString()] && (output || stepStatus === 'waiting_for_human')) ? `1px solid var(--border)` : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {step.name || step.objective.split('.')[0]}
                      </div>
                      {step.step_type === 'manual_review' && (
                        <div style={{ fontSize: '10px', background: '#FEF3DC', color: '#8A5C00', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, border: '1px solid #FDE68A' }}>MANUAL REVIEW</div>
                      )}
                    </div>
                    <div style={{ fontSize: '14px', color: circleColor }}>
                      {stepStatus === 'completed' ? '✓' : stepStatus === 'running' ? (
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                      ) : null}
                    </div>
                  </div>

                  {/* output visible when expanded */}
                  {expandedSteps[step.step_number.toString()] && output && (
                    <div style={{ margin: '0 16px 16px 16px', padding: '12px', fontSize: '13px', color: 'var(--text-secondary)', background: '#F7F6F3', border: '1px solid #D4CFC6', borderRadius: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                      {renderOutput(output)}
                    </div>
                  )}

                  {/* Inline checkpoint UI */}
                  {stepStatus === 'waiting_for_human' && (
                    <div style={{ padding: '16px', background: '#FFFFFF' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                        Input requested
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <button onClick={() => handleResume('Looks good, proceed')} disabled={submitting}
                                style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 500, color: '#4A4845', background: '#F7F6F3', border: '1px solid #D4CFC6', borderRadius: '100px', cursor: 'pointer' }}>
                          Looks good, proceed
                        </button>
                        <button onClick={() => handleResume('Revise the tone')} disabled={submitting}
                                style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 500, color: '#4A4845', background: '#F7F6F3', border: '1px solid #D4CFC6', borderRadius: '100px', cursor: 'pointer' }}>
                          Revise the tone
                        </button>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="text" 
                          placeholder="Provide custom feedback or direction..." 
                          value={humanInput}
                          onChange={(e) => setHumanInput(e.target.value)}
                          disabled={submitting}
                          style={{ flex: 1, padding: '10px 14px', fontSize: '13px', border: '1px solid var(--border)', borderRadius: '8px' }}
                        />
                        <button onClick={() => handleResume()} disabled={submitting || !humanInput}
                                style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 500, color: '#FFFFFF', background: '#1A1916', border: 'none', borderRadius: '8px', cursor: submitting || !humanInput ? 'not-allowed' : 'pointer' }}>
                          Submit
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {agentRuns.status === 'completed' && (
        <div style={{ marginTop: '30px', padding: '24px', background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--green)', marginBottom: '8px' }}>Run Completed Successfully</div>
          <p style={{ fontSize: '13px', color: 'var(--green)' }}>All automated steps and checkpoints passed. Outputs have been saved to the agent's memory banks permanently.</p>
        </div>
      )}
    </div>
  );
}
