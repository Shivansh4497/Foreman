'use client';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Page header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px',
      }}>
        <h1 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: '22px',
          letterSpacing: '-0.4px',
          color: 'var(--text-primary)',
        }}>
          Your workforce
        </h1>
        <button
          id="dashboard-hire-new-agent-btn"
          onClick={() => router.push('/create')}
          style={{
            padding: '9px 18px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#FFFFFF',
            background: '#1A1916',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.opacity = '0.85'; }}
          onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.opacity = '1'; }}
        >
          + Hire new agent
        </button>
      </div>

      {/* Empty state */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '380px',
        textAlign: 'center',
        gap: '14px',
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
        }}>
          ⚡
        </div>
        <div style={{
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          No agents hired yet
        </div>
        <div style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: '300px',
        }}>
          Tell Scout what you need. Scout will design the workflow, set the schedule, and put your first agent to work.
        </div>
        <button
          id="dashboard-hire-first-agent-btn"
          onClick={() => router.push('/create')}
          style={{
            padding: '11px 22px',
            fontSize: '14px',
            fontWeight: 500,
            color: '#FFFFFF',
            background: '#1A1916',
            border: 'none',
            borderRadius: '9px',
            cursor: 'pointer',
            marginTop: '4px',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.opacity = '0.85'; }}
          onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.opacity = '1'; }}
        >
          + Hire your first agent
        </button>
      </div>
    </div>
  );
}
