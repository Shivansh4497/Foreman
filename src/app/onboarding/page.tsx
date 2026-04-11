'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [provider, setProvider] = useState('OpenAI');
  const [model, setModel] = useState('GPT-4o (Recommended)');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        // Retrieve the current session access token for the API call
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          setSessionToken(sessionData.session.access_token);
        }
      }
    });
  }, []);

  const handleProviderSelect = (p: string, m: string) => {
    setProvider(p);
    setModel(m);
  };

  const handleNext = () => setStep(2);
  const handleBack = () => {
    setStep(1);
    setError('');
  };

  const handleSaveKey = async () => {
    if (!apiKey) {
      setError('Please enter a valid API key');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/keys/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {})
        },
        body: JSON.stringify({ provider, model, apiKey })
      });

      if (!res.ok) {
        throw new Error('Failed to securely store key');
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', minHeight: '100vh', margin: 0 }}>
      {/* ONBOARDING CARD */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '460px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
        
        {/* BACK BUTTON */}
        <button onClick={step === 2 ? handleBack : () => router.push('/signin')} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '18px' }}>
          ← Back
        </button>

        {/* PROGRESS DOTS */}
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ width: step === 1 ? '18px' : '6px', height: '6px', borderRadius: step === 1 ? '3px' : '50%', background: step === 1 ? 'var(--text-primary)' : 'var(--border)', transition: 'all 0.2s' }}></div>
          <div style={{ width: step === 2 ? '18px' : '6px', height: '6px', borderRadius: step === 2 ? '3px' : '50%', background: step === 2 ? 'var(--text-primary)' : 'var(--border)', transition: 'all 0.2s' }}></div>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border)' }}></div>
        </div>

        {/* S03: PROVIDER SELECTION */}
        {step === 1 && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px', letterSpacing: '-0.4px', color: 'var(--text-primary)', marginBottom: '6px' }}>Choose your AI provider</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: 1.5 }}>
              Foreman uses your own API key. You pay the provider directly — we never mark up AI costs.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              
              {/* OpenAI provider option */}
              <div onClick={() => handleProviderSelect('OpenAI', 'GPT-4o (Recommended)')} style={{ border: provider === 'OpenAI' ? '1.5px solid var(--accent)' : '1.5px solid var(--border)', background: provider === 'OpenAI' ? 'var(--accent-light)' : 'transparent', borderRadius: '10px', padding: '14px', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, background: 'var(--green-bg)', color: 'var(--green)', padding: '2px 7px', borderRadius: '4px', display: 'inline-block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Popular</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>OpenAI</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>GPT-4o, GPT-4o mini</div>
              </div>

              {/* Anthropic provider option */}
              <div onClick={() => handleProviderSelect('Anthropic', 'Claude 3.5 Sonnet')} style={{ border: provider === 'Anthropic' ? '1.5px solid var(--accent)' : '1.5px solid var(--border)', background: provider === 'Anthropic' ? 'var(--accent-light)' : 'transparent', borderRadius: '10px', padding: '14px', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ height: '18px', marginBottom: '6px' }}></div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Anthropic</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Claude 3.5, Haiku</div>
              </div>

              {/* Gemini provider option */}
              <div onClick={() => handleProviderSelect('Gemini', 'Gemini 1.5 Pro')} style={{ border: provider === 'Gemini' ? '1.5px solid var(--accent)' : '1.5px solid var(--border)', background: provider === 'Gemini' ? 'var(--accent-light)' : 'transparent', borderRadius: '10px', padding: '14px', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ height: '18px', marginBottom: '6px' }}></div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Gemini</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>1.5 Pro, Flash</div>
              </div>

              {/* Groq provider option */}
              <div onClick={() => handleProviderSelect('Groq', 'Llama 3')} style={{ border: provider === 'Groq' ? '1.5px solid var(--accent)' : '1.5px solid var(--border)', background: provider === 'Groq' ? 'var(--accent-light)' : 'transparent', borderRadius: '10px', padding: '14px', cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ height: '18px', marginBottom: '6px' }}></div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Groq</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Llama 3, Mixtral</div>
              </div>

            </div>

            <select value={model} onChange={(e) => setModel(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontFamily: 'inherit', fontSize: '13px', color: 'var(--text-primary)', background: 'var(--surface)', marginBottom: '16px', outline: 'none', appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\' fill=\'none\'%3E%3Cpath d=\'M3 4.5L6 7.5L9 4.5\' stroke=\'%237A7770\' stroke-width=\'1.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '32px' }}>
              {provider === 'OpenAI' && <option>GPT-4o (Recommended)</option>}
              {provider === 'OpenAI' && <option>GPT-4o mini</option>}
              {provider === 'Anthropic' && <option>Claude 3.5 Sonnet</option>}
              {provider === 'Anthropic' && <option>Claude 3 Haiku</option>}
              {provider === 'Gemini' && <option>Gemini 1.5 Pro</option>}
              {provider === 'Gemini' && <option>Gemini 1.5 Flash</option>}
              {provider === 'Groq' && <option>Llama 3</option>}
            </select>

            <button onClick={handleNext} style={{ width: '100%', padding: '13px', fontSize: '14px', fontWeight: 500, color: 'var(--surface)', background: 'var(--text-primary)', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
              Continue →
            </button>
          </div>
        )}

        {/* S04: API KEY SETUP */}
        {step === 2 && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '22px', letterSpacing: '-0.4px', color: 'var(--text-primary)', marginBottom: '6px' }}>Add your {provider} key</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
              Your key is encrypted immediately. It's never stored in plaintext or shared with anyone.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', color: 'var(--green)', fontWeight: 500 }}>
              🔒 Encrypted with Supabase Vault — plaintext never stored
            </div>

            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px', display: 'block' }}>API Key</label>
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <input 
                type="password" 
                placeholder={`sk-proj-••••••••••••••••••••••`} 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '10px 40px 10px 12px', 
                  border: '1.5px solid var(--border)', 
                  borderRadius: '8px', 
                  fontSize: '13px', 
                  color: 'var(--text-primary)', 
                  background: 'var(--surface)', 
                  WebkitTextFillColor: 'var(--text-primary)',
                  boxSizing: 'border-box', 
                  fontFamily: 'monospace',
                  outline: 'none'
                }} 
              />
            </div>
            
            {error && <div style={{ fontSize: '12px', color: 'var(--red)', marginBottom: '12px', background: 'var(--red-bg)', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--red-border)' }}>{error}</div>}

            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Don't have a key? <a href="#" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Get one from {provider} →</a>
            </div>

            <button disabled={loading} onClick={handleSaveKey} style={{ width: '100%', padding: '13px', fontSize: '14px', fontWeight: 500, color: 'var(--surface)', background: 'var(--text-primary)', border: 'none', borderRadius: '10px', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Securing key...' : 'Enter Foreman →'}
            </button>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
