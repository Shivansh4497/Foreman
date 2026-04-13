'use client';

interface Run {
  id: string;
  status: string;
  created_at: string;
  run_number: number;
  duration: string;
  cost: string;
}

interface ProfileHistoryTabProps {
  runs: Run[];
}

export default function ProfileHistoryTab({ runs }: ProfileHistoryTabProps) {
  if (!runs || runs.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        fontSize: '13px',
        color: 'var(--text-tertiary)'
      }}>
        No runs yet.
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'complete':
      case 'completed': return 'var(--green)';
      case 'failed': return 'var(--red)';
      case 'running': return 'var(--accent)';
      case 'waiting':
      case 'waiting_for_human': return 'var(--amber)';
      default: return 'var(--text-tertiary)';
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'min-content 1fr 1fr 1fr 1fr',
        padding: '0 0 12px 12px',
        fontSize: '10px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        color: 'var(--text-tertiary)',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ width: '20px' }}></div>
        <div>Date</div>
        <div>Run #</div>
        <div>Duration</div>
        <div>Cost</div>
      </div>
      {runs.map((run) => (
        <div key={run.id} style={{
          display: 'grid',
          gridTemplateColumns: 'min-content 1fr 1fr 1fr 1fr',
          padding: '14px 12px',
          alignItems: 'center',
          fontSize: '13px',
          color: 'var(--text-primary)',
          borderBottom: '1px solid var(--border)',
          transition: 'background 0.15s',
          cursor: 'default'
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: getStatusColor(run.status),
            animation: (run.status === 'running') ? 'pulse 1.2s ease-in-out infinite' : undefined
          }}></div>
          <div style={{ color: 'var(--text-secondary)' }}>{formatDate(run.created_at)}</div>
          <div style={{ fontWeight: 500 }}>Run {run.run_number || '—'}</div>
          <div style={{ color: 'var(--text-secondary)' }}>{run.duration || '—'}</div>
          <div style={{ color: 'var(--text-secondary)' }}>{run.cost || '$0.00'}</div>
        </div>
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
