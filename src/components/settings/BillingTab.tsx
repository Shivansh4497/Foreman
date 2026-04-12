'use client';

const FREE_FEATURES = [
  'Unlimited agents',
  'Unlimited runs',
  'Bring your own API key',
  'Real-time blueprint builder',
  'Agent memory (compounds over time)',
  'Email checkpoint notifications',
];

const PRO_FEATURES = [
  'Everything in Free',
  'Priority support',
  'Early access to new features',
  'Advanced usage analytics',
];

export default function BillingTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '520px' }}>

      {/* Current plan */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', marginBottom: '3px' }}>Current plan</div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Free</div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            $0<span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-tertiary)' }}>/mo</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {FREE_FEATURES.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4L3 5.5L6.5 2" stroke="#1A7A4A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade card */}
      <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border)', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Foreman Pro</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--accent)', letterSpacing: '-0.3px' }}>
            $20<span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--accent)' }}>/mo</span>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--accent)', marginBottom: '16px' }}>Coming soon · Post-beta</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
          {PRO_FEATURES.map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1.5 4L3 5.5L6.5 2" stroke="#2E5BBA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              {f}
            </div>
          ))}
        </div>

        <button
          id="settings-upgrade-btn"
          disabled
          title="Pro plan launches post-beta"
          style={{
            width: '100%', padding: '11px',
            fontSize: '14px', fontWeight: 500,
            color: '#FFFFFF', background: 'var(--accent)',
            border: 'none', borderRadius: '9px',
            cursor: 'not-allowed', opacity: 0.5,
          }}
        >
          Upgrade to Pro
        </button>

        <div style={{ fontSize: '11px', color: 'var(--accent)', textAlign: 'center', marginTop: '10px' }}>
          Billing is not yet active. Pro plan launches post-beta.
        </div>
      </div>

    </div>
  );
}
