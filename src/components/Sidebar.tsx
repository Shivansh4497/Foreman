import React from 'react'

export default function Sidebar() {
  const styles = {
    sidebar: {
      width: '200px',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      padding: '16px 0',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '2px',
      minHeight: '100vh',
    },
    logoArea: {
      padding: '0 14px 14px',
      borderBottom: '1px solid var(--border)',
      marginBottom: '6px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    logoMark: {
      width: '26px',
      height: '26px',
      background: 'var(--text-primary)',
      borderRadius: '6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    navItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '7px 14px',
      fontSize: '12px',
      fontWeight: 500,
      color: 'var(--text-secondary)',
      border: 'none',
      background: 'none',
      width: '100%',
      textAlign: 'left' as const,
      cursor: 'pointer',
      fontFamily: "'DM Sans', sans-serif"
    },
    activeNavItem: {
      color: 'var(--text-primary)',
      background: 'var(--surface2)',
    },
    bottomArea: {
      marginTop: 'auto',
      padding: '10px 14px',
      borderTop: '1px solid var(--border)',
    },
    userRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    userAvatar: {
      width: '26px',
      height: '26px',
      background: 'var(--accent-light)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '10px',
      fontWeight: 600,
      color: 'var(--accent)',
    }
  }

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logoArea}>
        <div style={styles.logoMark}>
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

      <button style={{ ...styles.navItem, ...styles.activeNavItem }}>
        <span style={{ fontSize: '13px', width: '16px', textAlign: 'center' }}>⊞</span> Workforce
      </button>
      <button style={styles.navItem}>
        <span style={{ fontSize: '13px', width: '16px', textAlign: 'center' }}>↗</span> Activity
      </button>
      <button style={styles.navItem}>
        <span style={{ fontSize: '13px', width: '16px', textAlign: 'center' }}>◎</span> Usage
      </button>
      <button style={styles.navItem}>
        <span style={{ fontSize: '13px', width: '16px', textAlign: 'center' }}>⚙</span> Settings
      </button>

      <div style={styles.bottomArea}>
        <div style={styles.userRow}>
          <div style={styles.userAvatar}>U</div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>User</div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Free plan</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
