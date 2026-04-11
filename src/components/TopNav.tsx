export default function TopNav() {
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 20px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '28px',
          height: '28px',
          background: 'var(--text-primary)',
          borderRadius: '7px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <svg viewBox="0 0 18 18" fill="none" width="14" height="14">
            <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white"/>
            <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" opacity="0.6"/>
            <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.6"/>
            <rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" opacity="0.3"/>
          </svg>
        </div>
        <span style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
          Foreman
        </span>
      </div>
      
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {/* Actions slot */}
      </div>
    </nav>
  )
}
