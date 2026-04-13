'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Config {
  provider: string | null;
  model: string | null;
  updated_at: string | null;
}

const PROVIDERS: Record<string, { models: string[]; placeholder: string }> = {
  OpenAI: { models: ['GPT-4o (Recommended)', 'GPT-4o mini'], placeholder: 'sk-proj-••••••••••••••••••••••' },
  Anthropic: { models: ['Claude 3.5 Sonnet', 'Claude 3 Haiku'], placeholder: 'sk-ant-••••••••••••••••••••••' },
  Gemini: { models: ['Gemini 1.5 Pro', 'Gemini 1.5 Flash'], placeholder: 'AIza••••••••••••••••••••••' },
  Groq: { models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'], placeholder: 'gsk_••••••••••••••••••••••' },
};

export default function ApiKeyTab() {
  const router = useRouter();
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [provider, setProvider] = useState('OpenAI');
  const [model, setModel] = useState('GPT-4o (Recommended)');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push('/signin'); return; }

        const res = await fetch('/api/settings/config', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error('Failed to load key config');
        const data: Config = await res.json();
        setConfig(data);
        if (data.provider) setProvider(data.provider);
        if (data.model) setModel(data.model);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const handleSave = async () => {
    if (!apiKey.trim()) { setSaveError('Please enter a valid API key.'); return; }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch('/api/keys/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ provider, model, apiKey }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to save key');
      }

      setConfig({ provider, model, updated_at: new Date().toISOString() });
      setApiKey('');
      setShowForm(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    border: '1.5px solid var(--border)', borderRadius: '8px',
    fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
    color: '#1A1916' as const, background: '#FFFFFF' as const,
    WebkitTextFillColor: '#1A1916' as const, outline: 'none', boxSizing: 'border-box',
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[100, 70].map(w => (
        <div key={w} style={{ height: '16px', width: `${w}%`, background: 'var(--border)', borderRadius: '6px', opacity: 0.5 }} />
      ))}
    </div>
  );

  if (error) return (
    <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: '10px', padding: '14px', fontSize: '13px', color: 'var(--red)' }}>
      {error}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '520px' }}>

      {/* Success toast */}
      {saveSuccess && (
        <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: 'var(--green)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
          ✓ API key updated securely
        </div>
      )}

      {/* Current config card */}
      {config?.provider && !showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-tertiary)', marginBottom: '3px' }}>Current provider</div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{config.provider}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>{config.model}</div>
            </div>
            <button
              id="settings-update-key-btn"
              onClick={() => setShowForm(true)}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s' }}
              onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = 'var(--accent)'; (e.target as HTMLElement).style.color = 'var(--accent)'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'var(--border)'; (e.target as HTMLElement).style.color = 'var(--text-secondary)'; }}
            >
              Update key
            </button>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--green-bg)' }}>
            <span style={{ fontSize: '13px' }}>🔒</span>
            <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 500 }}>
              Encrypted with Supabase Vault — plaintext never stored
            </span>
          </div>
          <div style={{ padding: '10px 16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Last updated: {formatDate(config.updated_at)}</span>
          </div>
        </div>
      )}

      {/* Update form */}
      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Update API key</div>
            <button onClick={() => { setShowForm(false); setSaveError(null); setApiKey(''); }} style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>

          {/* Provider grid */}
          <div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px', display: 'block' }}>Provider</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {Object.keys(PROVIDERS).map(p => (
                <div
                  key={p}
                  id={`settings-provider-${p.toLowerCase()}`}
                  onClick={() => { setProvider(p); setModel(PROVIDERS[p].models[0]); }}
                  style={{
                    border: provider === p ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                    background: provider === p ? 'var(--accent-light)' : 'transparent',
                    borderRadius: '10px', padding: '12px', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {p === 'OpenAI' && <div style={{ fontSize: '10px', fontWeight: 600, background: 'var(--green-bg)', color: 'var(--green)', padding: '2px 7px', borderRadius: '4px', display: 'inline-block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Popular</div>}
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{p}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Model select */}
          <div>
            <label htmlFor="settings-model-select" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px', display: 'block' }}>Model</label>
            <select
              id="settings-model-select"
              value={model}
              onChange={e => setModel(e.target.value)}
              style={{ ...inputStyle, appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\' fill=\'none\'%3E%3Cpath d=\'M3 4.5L6 7.5L9 4.5\' stroke=\'%237A7770\' stroke-width=\'1.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '32px' }}
            >
              {PROVIDERS[provider]?.models.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          {/* API key input */}
          <div>
            <label htmlFor="settings-api-key-input" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px', display: 'block' }}>New API key</label>
            <div style={{ position: 'relative' }}>
              <input
                id="settings-api-key-input"
                type={showKey ? 'text' : 'password'}
                placeholder={PROVIDERS[provider]?.placeholder}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{ ...inputStyle, paddingRight: '52px', fontFamily: 'monospace' }}
              />
              <button
                onClick={() => setShowKey(v => !v)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: '12px', color: 'var(--text-tertiary)', cursor: 'pointer' }}
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Security badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--green-bg)', border: '1px solid var(--green-border)', borderRadius: '8px', fontSize: '12px', color: 'var(--green)', fontWeight: 500 }}>
            🔒 Encrypted with Supabase Vault — plaintext never stored
          </div>

          {saveError && (
            <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--red)' }}>
              {saveError}
            </div>
          )}

          <button
            id="settings-save-key-btn"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '11px', fontSize: '14px', fontWeight: 500, color: '#FFFFFF', background: '#1A1916', border: 'none', borderRadius: '9px', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.5 : 1, transition: 'opacity 0.15s' }}
          >
            {saving ? 'Saving key…' : 'Save new key'}
          </button>
        </div>
      )}

      {/* No config state */}
      {!config?.provider && !showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>No API key configured yet.</div>
          <button id="settings-add-key-btn" onClick={() => setShowForm(true)} style={{ padding: '9px 20px', fontSize: '13px', fontWeight: 500, color: '#FFFFFF', background: '#1A1916', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Add API key
          </button>
        </div>
      )}
    </div>
  );
}
