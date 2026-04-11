'use client';

import React from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase';

export default function LandingPage() {
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
    <div style={{ background: 'var(--bg)', color: 'var(--text-primary)', minHeight: '100vh', padding: 0 }}>
      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 40px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', background: 'var(--text-primary)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 18 18" fill="none" width="14" height="14">
              <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white" />
              <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" opacity="0.6" />
              <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.6" />
              <rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.3" />
            </svg>
          </div>
          <span style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.3px' }}>Foreman</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button style={{ padding: '7px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>How it works</button>
          <Link href="/signin">
            <button style={{ padding: '7px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--surface)', background: 'var(--text-primary)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Sign in</button>
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '72px 40px 48px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'var(--accent-light)', border: '1px solid var(--accent-border)', borderRadius: '100px', fontSize: '12px', fontWeight: 500, color: 'var(--accent)', marginBottom: '28px' }}>
          <div style={{ width: '6px', height: '6px', background: 'var(--accent)', borderRadius: '50%' }}></div>
          Now in early access
        </div>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '56px', lineHeight: 1.05, letterSpacing: '-1.5px', color: 'var(--text-primary)', marginBottom: '20px' }}>
          Your AI workforce,<br /><em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>hired in minutes.</em>
        </h1>
        <p style={{ fontSize: '17px', lineHeight: 1.6, color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 36px' }}>
          Tell Scout what you need. Scout builds the agent, designs the workflow, and puts it to work. No code. No AI engineer.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '14px' }}>
          <button onClick={handleGoogleLogin} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 24px', fontSize: '14px', fontWeight: 500, color: 'var(--surface)', background: 'var(--text-primary)', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>
            <div style={{ width: '18px', height: '18px', background: 'var(--surface)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'var(--google-blue)' }}>G</div>
            Continue with Google
          </button>
          <button style={{ padding: '13px 22px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '10px', cursor: 'pointer' }}>
            See how it works
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          Free to start &nbsp;·&nbsp; Bring your own API key &nbsp;·&nbsp; No credit card required
        </p>
      </div>

      {/* PRODUCT PREVIEW */}
      <div style={{ maxWidth: '960px', margin: '0 auto 48px', padding: '0 32px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <div style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--apple-red)' }}></div>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--apple-yellow)' }}></div>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--apple-green)' }}></div>
            <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '5px', padding: '4px 12px', fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center', margin: '0 12px' }}>
              app.foreman.so/create
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '300px', textAlign: 'left' }}>
            <div style={{ borderRight: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-tertiary)' }}>
                Scout — your chief of staff
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>Scout</div>
                <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border)', padding: '10px 12px', borderRadius: '9px', fontSize: '12px', lineHeight: 1.55, color: 'var(--text-primary)', maxWidth: '85%' }}>
                  <strong>What should this agent do for you?</strong>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: '9px', fontSize: '12px', lineHeight: 1.55, color: 'var(--text-primary)', maxWidth: '88%' }}>
                  Weekly LinkedIn post generator. Find hot AI topics, no repeats, ask for my approval, write in my voice.
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>Scout</div>
                <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-border)', padding: '10px 12px', borderRadius: '9px', fontSize: '12px', lineHeight: 1.55, color: 'var(--text-primary)', maxWidth: '88%' }}>
                  Got it — blueprint's on the right. Do you want 3 topic options or should I pick the strongest?
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--bg)', padding: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>LinkedIn Post Generator</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '14px' }}>Updates in real time as you chat</div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', marginBottom: '7px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)' }}>1</div>
                <div style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>Find hot AI topics this week</div>
                <div style={{ background: 'var(--green-bg)', color: 'var(--green)', fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Auto</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', marginBottom: '7px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)' }}>2</div>
                <div style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>Check last 5 posts for overlap</div>
                <div style={{ background: 'var(--green-bg)', color: 'var(--green)', fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Auto</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', border: '1px solid var(--accent-border)', borderRadius: '8px', padding: '9px 12px', marginBottom: '7px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, color: 'var(--accent)' }}>4</div>
                <div style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>You select a topic</div>
                <div style={{ background: 'var(--amber-bg)', color: 'var(--amber)', fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Review</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', marginBottom: '7px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)' }}>5</div>
                <div style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>Draft post in your voice</div>
                <div style={{ background: 'var(--green-bg)', color: 'var(--green)', fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Auto</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 40px 60px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', textAlign: 'left' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '22px', marginBottom: '10px' }}>⚡</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Scout builds the workflow</div>
          <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>Describe your task in plain English. Scout designs the full agent workflow in real time.</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '22px', marginBottom: '10px' }}>✋</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>You stay in control</div>
          <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>Set human approval checkpoints anywhere. Agents pause and wait before any critical action.</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '22px', marginBottom: '10px' }}>🧠</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Agents get smarter over time</div>
          <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>Every run teaches your agent more about how you work. Run 10 is visibly better than Run 1.</div>
        </div>
      </div>
    </div>
  );
}
