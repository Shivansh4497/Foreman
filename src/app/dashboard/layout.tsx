import React from 'react';
import Sidebar from '../../components/Sidebar';
import AuthGuard from '../../components/AuthGuard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr',
        minHeight: '100vh',
        backgroundColor: 'var(--bg, #F7F6F3)'
      }}>
        <Sidebar />
        <main>
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
