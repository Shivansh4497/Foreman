'use client';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface UsageData {
  total_agents: number;
  active_agents: number;
  total_runs: number;
  total_hours_saved: number;
  agents: Array<{
    name: string;
    status: string;
    total_runs: number;
    hours_saved: number;
  }>;
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  active:  { bg: 'var(--green-bg)',  color: 'var(--green)',  label: 'Active' },
  running: { bg: 'var(--accent-light)', color: 'var(--accent)', label: 'Running' },
  paused:  { bg: 'var(--surface2)', color: 'var(--text-tertiary)', label: 'Paused' },
  failed:  { bg: 'var(--red-bg)',   color: 'var(--red)',   label: 'Failed' },
};

export default function UsageTab() {
  const router = useRouter();
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push('/signin'); return; }

        const res = await fetch('/api/settings/usage', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error('Failed to load usage data');
        setData(await res.json());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load usage');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ height: '100px', background: 'var(--border)', borderRadius: '12px', opacity: 0.4 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
        {[1,2,3,4].map(i => <div key={i} style={{ height: '72px', background: 'var(--border)', borderRadius: '10px', opacity: 0.3 }} />)}
      </div>
    </div>
  );

  if (error) return (
    <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: '10px', padding: '14px', fontSize: '13px', color: 'var(--red)' }}>
      {error}
    </div>
  );

  const stats = [
    { label: 'Active agents', value: String(data?.active_agents ?? 0) },
    { label: 'Total runs', value: String(data?.total_runs ?? 0) },
    { label: 'Hours saved', value: `${data?.total_hours_saved ?? 0}h` },
    { label: 'API cost', value: '$0.00', note: 'Tracking soon' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px' }}>

      {/* Hero card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
          Total runs
        </div>
        <div style={{ fontSize: '32px', fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--text-primary)', lineHeight: 1 }}>
          {data?.total_runs ?? 0}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          across {data?.total_agents ?? 0} agent{data?.total_agents !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-tertiary)', marginBottom: '5px' }}>{s.label}</div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>{s.value}</div>
            {s.note && <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '3px' }}>{s.note}</div>}
          </div>
        ))}
      </div>

      {/* Per-agent table */}
      {(data?.agents?.length ?? 0) > 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr auto 80px 80px', gap: '12px' }}>
            {['Agent', 'Status', 'Runs', 'Hrs saved'].map(h => (
              <div key={h} style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text-tertiary)' }}>{h}</div>
            ))}
          </div>
          {data!.agents.map((agent, i) => {
            const badge = STATUS_BADGE[agent.status] ?? STATUS_BADGE.paused;
            return (
              <div key={i} style={{ padding: '12px 16px', borderBottom: i < data!.agents.length - 1 ? '1px solid var(--border)' : 'none', display: 'grid', gridTemplateColumns: '1fr auto 80px 80px', gap: '12px', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{agent.name}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '100px', fontSize: '11px', fontWeight: 600, background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>
                  <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor' }} />
                  {badge.label}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{agent.total_runs}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{agent.hours_saved}h</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            No active agents yet.<br />Hire your first agent to start tracking usage.
          </div>
        </div>
      )}

      {/* Cost disclaimer */}
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        API costs are calculated using your provider&apos;s pricing. Detailed per-run cost tracking
        becomes available once agent execution is enabled in a future update.
      </div>
    </div>
  );
}
