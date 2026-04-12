'use client';
import React from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const navItem = (label: string, icon: string, path: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 14px',
    fontSize: '12px',
    fontWeight: 500,
    color: pathname === path || pathname.startsWith(path + '/') ? 'var(--text-primary)' : 'var(--text-secondary)',
    background: pathname === path || pathname.startsWith(path + '/') ? 'var(--surface2)' : 'none',
    border: 'none',
    width: '100%',
    textAlign: 'left' as const,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'color 0.15s, background 0.15s',
  });

  const NAV_ITEMS = [
    { label: 'Workforce', icon: '⊞', path: '/dashboard' },
    { label: 'Activity',  icon: '↗', path: '/dashboard/activity' },
    { label: 'Usage',     icon: '◎', path: '/dashboard/usage' },
    { label: 'Settings',  icon: '⚙', path: '/dashboard/settings' },
  ];

  return (
    <aside style={{
      width: '200px',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      padding: '16px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      minHeight: '100vh',
    }}>
      {/* Logo area */}
      <div style={{
        padding: '0 14px 14px',
        borderBottom: '1px solid var(--border)',
        marginBottom: '6px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div style={{
          width: '26px',
          height: '26px',
          background: 'var(--text-primary)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg viewBox="0 0 18 18" fill="none" width="14" height="14">
            <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white"/>
            <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" opacity="0.6"/>
            <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.6"/>
            <rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.3"/>
          </svg>
        </div>
        <span style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
          Foreman
        </span>
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map(item => (
        <button
          key={item.label}
          id={`sidebar-nav-${item.label.toLowerCase()}`}
          style={navItem(item.label, item.icon, item.path)}
          onClick={() => router.push(item.path)}
          onMouseEnter={e => {
            if (pathname !== item.path) {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
              (e.currentTarget as HTMLElement).style.background = 'var(--surface2)';
            }
          }}
          onMouseLeave={e => {
            if (pathname !== item.path) {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              (e.currentTarget as HTMLElement).style.background = 'none';
            }
          }}
        >
          <span style={{ fontSize: '13px', width: '16px', textAlign: 'center' }}>{item.icon}</span>
          {item.label}
        </button>
      ))}

      {/* Bottom user area */}
      <div style={{ marginTop: 'auto', padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '26px', height: '26px',
            background: 'var(--accent-light)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 600, color: 'var(--accent)',
          }}>
            U
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>User</div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Free plan</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
