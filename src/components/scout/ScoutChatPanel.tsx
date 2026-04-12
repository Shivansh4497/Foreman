'use client';
import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase';

interface Message {
  role: 'scout' | 'user';
  content: string;
}

interface BlueprintJSON {
  agent_name: string;
  schedule: string;
  output_format: string;
  category: string;
  human_hours_per_run: number;
  steps: Array<{
    step_number: number;
    name: string;
    step_type: 'automated' | 'manual_review';
    objective: string;
    inputs: string;
    output_format: string;
    quality_rules: string;
    failure_conditions: string;
    loop_back_step_number: number | null;
  }>;
}

interface ScoutChatPanelProps {
  agentId: string;
  initialMessage: string;
  onBlueprintUpdated: (blueprint: BlueprintJSON) => void;
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignSelf: 'flex-start', maxWidth: '88%' }}>
      <span style={{
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.4px',
        textTransform: 'uppercase' as const,
        color: 'var(--accent)',
        marginBottom: '2px',
      }}>Scout</span>
      <div style={{
        background: 'var(--accent-light)',
        border: '1px solid var(--accent-border)',
        padding: '12px 16px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
      }}>
        <style>{`
          @keyframes tdot {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
            30% { transform: translateY(-4px); opacity: 1; }
          }
        `}</style>
        {[0, 0.2, 0.4].map((delay, i) => (
          <div
            key={i}
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: 'var(--accent)',
              animation: `tdot 1.2s ease-in-out ${delay}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ScoutChatPanel({ agentId, initialMessage, onBlueprintUpdated }: ScoutChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'scout', content: initialMessage },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isTyping) return;

    setInputValue('');
    setError(null);
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsTyping(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session has expired. Please sign in again.');

      const res = await fetch('/api/scout/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ agent_id: agentId, message: text }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Scout failed to respond. Please try again.');
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'scout', content: data.scout_message }]);

      if (data.blueprint_updated && data.blueprint) {
        onBlueprintUpdated(data.blueprint);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Scout failed to respond. Please try again.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      borderRight: '1px solid var(--border)',
      background: 'var(--surface)',
      overflow: 'hidden',
    }}>
      {/* Panel Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.4px',
          color: 'var(--text-tertiary)',
        }}>
          Scout — Your Chief of Staff
        </div>
      </div>

      {/* Message List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {messages.map((msg, idx) =>
          msg.role === 'scout' ? (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignSelf: 'flex-start', maxWidth: '88%' }}>
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                color: 'var(--accent)',
              }}>Scout</span>
              <div style={{
                background: 'var(--accent-light)',
                border: '1px solid var(--accent-border)',
                color: 'var(--text-primary)',
                padding: '11px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                lineHeight: 1.55,
              }}>
                {msg.content}
              </div>
            </div>
          ) : (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignSelf: 'flex-end', maxWidth: '88%' }}>
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                textAlign: 'right',
              }}>You</span>
              <div style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                padding: '11px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                lineHeight: 1.55,
              }}>
                {msg.content}
              </div>
            </div>
          )
        )}

        {isTyping && <TypingIndicator />}

        {error && (
          <div style={{
            background: 'var(--red-bg)',
            border: '1px solid var(--red-border)',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '12px',
            color: 'var(--red)',
          }}>
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Area */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '8px',
          background: 'var(--bg)',
          border: '1.5px solid var(--border)',
          borderRadius: '10px',
          padding: '9px 12px',
        }}>
          <textarea
            id="scout-chat-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell Scout what you need…"
            rows={1}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              color: '#1A1916',
              WebkitTextFillColor: '#1A1916',
              outline: 'none',
              resize: 'none',
              lineHeight: 1.5,
              overflowY: 'hidden',
              padding: 0,
            }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
            }}
            disabled={isTyping}
          />
          <button
            id="scout-send-btn"
            onClick={sendMessage}
            disabled={!inputValue.trim() || isTyping}
            aria-label="Send message"
            style={{
              width: '30px',
              height: '30px',
              background: '#1A1916',
              border: 'none',
              borderRadius: '7px',
              cursor: !inputValue.trim() || isTyping ? 'default' : 'pointer',
              opacity: !inputValue.trim() || isTyping ? 0.3 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'opacity 0.15s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 12V3M3 7l4-4 4 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '6px', textAlign: 'center' }}>
          Press Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
