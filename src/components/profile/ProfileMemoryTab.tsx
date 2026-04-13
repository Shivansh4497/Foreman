'use client';

interface ProfileMemoryTabProps {
  memory: string | null;
}

export default function ProfileMemoryTab({ memory }: ProfileMemoryTabProps) {
  if (!memory || memory.trim() === '') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        textAlign: 'center',
        padding: '0 40px'
      }}>
        <div style={{
          fontSize: '13px',
          color: 'var(--text-tertiary)',
          lineHeight: 1.6,
          maxWidth: '300px'
        }}>
          This agent hasn't learned anything yet.
          Memory builds after each run.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      fontSize: '13px',
      lineHeight: 1.7,
      color: 'var(--text-secondary)',
      whiteSpace: 'pre-wrap'
    }}>
      {memory}
    </div>
  );
}
