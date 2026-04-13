'use client';

interface ProfileMemoryTabProps {
  memory: string | null;
}

export default function ProfileMemoryTab({ memory }: ProfileMemoryTabProps) {
  const lines = (memory || '')
    .split('\n')
    .map((l: string) => l.replace(/^\[\d{4}-\d{2}-\d{2}\]\s*/, '').trim())
    .filter((l: string) => l.length > 0);

  if (lines.length === 0) {
    return (
      <div style={{
        fontSize: '12px',
        color: '#7A7770',
        textAlign: 'center',
        marginTop: '24px'
      }}>
        No memory yet. Run the agent and give feedback to start building memory.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {lines.map((line, idx) => (
        <div key={idx} style={{
          background: '#F7F6F3',
          border: '1px solid #D4CFC6',
          borderRadius: '8px',
          padding: '9px 12px',
          marginBottom: '6px',
          fontSize: '12px',
          color: '#1A1916',
          lineHeight: 1.5
        }}>
          {line}
        </div>
      ))}
    </div>
  );
}
