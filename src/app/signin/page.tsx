'use client';

import React from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase';

export default function SignInPage() {
  const handleGoogleLogin = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div style={{ background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', minHeight: '100vh', margin: 0 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '48px 40px', width: '100%', maxWidth: '420px', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '28px' }}>
          <div style={{ width: '36px', height: '36px', background: 'var(--text-primary)', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
              <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white" />
              <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" opacity="0.6" />
              <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.6" />
              <rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.3" />
            </svg>
          </div>
          <span style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>Foreman</span>
        </div>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '26px', letterSpacing: '-0.5px', textAlign: 'center', marginBottom: '8px', color: 'var(--text-primary)' }}>
          Welcome to Foreman
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '28px', lineHeight: 1.5 }}>
          Sign in to build your AI workforce. No code required.
        </p>
        <button onClick={handleGoogleLogin} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', width: '100%', padding: '14px', fontSize: '15px', fontWeight: 500, color: 'var(--surface)', background: 'var(--text-primary)', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
          <div style={{ width: '20px', height: '20px', background: 'var(--surface)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24">
              <path fill="var(--google-blue)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="var(--google-green)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="var(--google-yellow)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="var(--google-red)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          </div>
          Continue with Google
        </button>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginTop: '20px' }}>
          By continuing, you agree to our <a href="#" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Terms of Service</a> and <a href="#" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Privacy Policy</a>.<br />
          Your data is never used to train AI models.
        </p>
      </div>
    </div>
  );
}
