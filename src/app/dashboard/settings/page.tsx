'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AccountTab from '@/components/settings/AccountTab';
import ApiKeyTab from '@/components/settings/ApiKeyTab';
import UsageTab from '@/components/settings/UsageTab';
import BillingTab from '@/components/settings/BillingTab';

type Tab = 'account' | 'apikey' | 'usage' | 'billing';

const TABS: { id: Tab; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'apikey', label: 'API Key' },
  { id: 'usage', label: 'Usage' },
  { id: 'billing', label: 'Billing' },
];

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('account');

  // Sync tab from URL param: /dashboard/settings?tab=apikey
  useEffect(() => {
    const tab = searchParams.get('tab') as Tab | null;
    if (tab && TABS.some(t => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    router.replace(`/dashboard/settings?tab=${tab}`, { scroll: false });
  };

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Page heading */}
      <h1 style={{
        fontFamily: "'DM Serif Display', serif",
        fontSize: '22px',
        letterSpacing: '-0.4px',
        color: 'var(--text-primary)',
        marginBottom: '20px',
      }}>
        Settings
      </h1>

      {/* Tab row */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        marginBottom: '24px',
        gap: '0',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            id={`settings-tab-${tab.id}`}
            onClick={() => handleTabChange(tab.id)}
            style={{
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--text-primary)' : '2px solid transparent',
              marginBottom: '-1px',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ animation: 'fadeIn 0.2s ease' }}>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        {activeTab === 'account' && <AccountTab />}
        {activeTab === 'apikey'  && <ApiKeyTab />}
        {activeTab === 'usage'   && <UsageTab />}
        {activeTab === 'billing' && <BillingTab />}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '24px 28px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
        Loading settings…
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
