'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase';

interface AccountData {
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
}

export default function AccountTab() {
  const router = useRouter();
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push('/signin'); return; }

        const res = await fetch('/api/settings/account', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error('Failed to load account info');
        setData(await res.json());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load account');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/signin');
  };

  const initials = (name: string | null, email: string | null) => {
    if (name) return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
    if (email) return email[0].toUpperCase();
    return 'U';
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[100, 80, 60].map(w => (
        <div key={w} style={{ height: '16px', width: `${w}%`, background: 'var(--border)', borderRadius: '6px', opacity: 0.5 }} />
      ))}
    </div>
  );

  if (error) return (
    <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: '10px', padding: '14px 16px', fontSize: '13px', color: 'var(--red)' }}>
      {error}
      <button onClick={() => window.location.reload()} style={{ marginLeft: '12px', fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
        Retry
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '520px' }}>

      {/* Profile card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        {data?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.avatar_url}
            alt="Profile"
            width={48}
            height={48}
            style={{ borderRadius: '50%', flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'var(--accent-light)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '18px', fontWeight: 600,
            color: 'var(--accent)', flexShrink: 0,
          }}>
            {initials(data?.full_name ?? null, data?.email ?? null)}
          </div>
        )}
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
            {data?.full_name ?? 'Your account'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{data?.email ?? '—'}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
            Signed in with Google · Member since {formatDate(data?.created_at ?? null)}
          </div>
        </div>
      </div>

      {/* Account details */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        {[
          { label: 'Email address', value: data?.email ?? '—' },
          { label: 'Full name', value: data?.full_name ?? '—' },
          { label: 'Auth provider', value: 'Google OAuth' },
        ].map((row, i, arr) => (
          <div key={row.label} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 16px',
            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{row.label}</span>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Sign out */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Sign out</div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>You'll need to sign in again with Google.</div>
        </div>
        <button
          id="settings-sign-out-btn"
          onClick={handleSignOut}
          disabled={signingOut}
          style={{
            padding: '8px 16px', fontSize: '13px', fontWeight: 500,
            color: 'var(--text-secondary)', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: '8px',
            cursor: signingOut ? 'default' : 'pointer',
            opacity: signingOut ? 0.5 : 1, transition: 'opacity 0.15s',
          }}
        >
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>

      {/* Danger zone */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--red-border)', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--red)' }}>Delete account</div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Permanently removes your account and all agents.</div>
        </div>
        <button
          disabled
          title="Contact support to delete your account"
          style={{
            padding: '8px 16px', fontSize: '13px', fontWeight: 500,
            color: 'var(--red)', background: 'var(--red-bg)',
            border: '1px solid var(--red-border)', borderRadius: '8px',
            cursor: 'not-allowed', opacity: 0.5,
          }}
        >
          Delete account
        </button>
      </div>
    </div>
  );
}
