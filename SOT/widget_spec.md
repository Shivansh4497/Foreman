# Foreman — LiveRunWidget & Conversation Thread Fix Spec
**File:** `src/app/dashboard/conversation/[agentId]/page.tsx`
**Model:** Gemini Flash
**Attach:** @builder.md

---

## What is broken and why

### Current broken behaviour
When the user clicks "Run now", a `LiveRunWidget` is appended to the
thread. The thread does not scroll to it. Only its top 1px border
shows at the bottom of the visible area — a faint amber/yellow line.
The widget never becomes fully visible unless the user manually scrolls.

### Root cause chain (3 bugs)

**Bug 1 — Auto-scroll fires before the widget has rendered height.**
The current code scrolls `bottomRef` when `activeRunId` changes.
But at that moment the widget has zero height (data hasn't loaded yet).
Three seconds later when the poll returns and the widget grows to full
height, no scroll fires because no dependency changed.

**Bug 2 — `bottomRef` is declared outside and placed inside `useMemo`.**
The ref div `<div key="bottom" ref={bottomRef} />` is pushed into the
memoized elements array. React reconciles it as a new element every
memo recompute, making the ref attachment unreliable.

**Bug 3 — LiveRunWidget outer border turns amber during waiting_for_human.**
The BUG C cardBorder fix was applied (or bled) to the LiveRunWidget
outer div. When run status is `waiting_for_human`, the border becomes
`1px solid #F5D98A` (amber), creating the yellow line.

---

## Desired behaviour (source of truth)

### Thread auto-scroll rules
- Any time a new message appears at the bottom → thread scrolls to bottom
- Any time LiveRunWidget is first rendered → thread scrolls to it
- Any time LiveRunWidget receives new data (poll returns) → thread scrolls to bottom of widget
- Scrolling is `behavior: 'smooth'`

### LiveRunWidget lifecycle
```
activeRunId = 'starting'   → Widget shows "Starting agent..." loading state
activeRunId = <uuid>       → Widget polls and shows live steps
run.status = 'running'     → Steps update in real time, spinner on current step
run.status = 'waiting_for_human' → Checkpoint UI appears inline under that step
run.status = 'completed'   → onComplete() called after 800ms → widget unmounts
run.status = 'failed'      → onComplete() called after 800ms → widget unmounts
run.status = 'cancelled'   → onComplete() called after 800ms → widget unmounts

NOTE: 800ms delay is intentional — just long enough for the user to
register the terminal state before the widget is replaced by the RunCard.
Do not set to 0ms (jarring) or 1500ms (too slow).
```

After `onComplete()` → `activeRunId` set to null → widget removed from thread →
Trigger.dev has already inserted a `run_card` message → next poll renders it as RunCard.

---

## The fix — exact changes to make

### CHANGE 1 — Fix auto-scroll: move bottomRef inside LiveRunWidget

**Remove from ConversationInner:**
```tsx
// DELETE this ref declaration:
const bottomRef = useRef<HTMLDivElement>(null);

// DELETE this useEffect:
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages.length, activeRunId]);

// DELETE this line from inside the useMemo:
elements.push(<div key="bottom" ref={bottomRef} />);
```

**Add to ConversationInner instead:**
```tsx
// Scroll to bottom of thread whenever messages change (no active run)
useEffect(() => {
  if (threadRef.current) {
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }
}, [messages.length]);
```

**Add inside LiveRunWidget component:**
```tsx
// Declare inside LiveRunWidget:
const widgetBottomRef = useRef<HTMLDivElement>(null);

// Inside poll() function, after setRun(runData) and setSteps(stepsData):
setTimeout(() => {
  widgetBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
}, 150);

// Place at the very bottom of LiveRunWidget's return JSX
// (after all step rows and checkpoint UI, inside the outermost div):
<div ref={widgetBottomRef} style={{ height: '1px' }} />
```

---

### NOTE ON CHECKPOINT QUICK REPLIES
Keep the two quick reply pills hardcoded as `['Looks good, proceed', 'Revise the tone']`.
Context-aware pills are a future enhancement — do not change this now.

---

### CHANGE 2 — Fix LiveRunWidget outer border (always neutral grey)

The LiveRunWidget outer div must ALWAYS have a neutral border.
It must NEVER change colour based on run status.

**Find the LiveRunWidget outer return div. It looks like:**
```tsx
return (
  <div style={{
    background: '#FFFFFF',
    border: '1px solid #D4CFC6',   // ← THIS must always be this value
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '24px',
    maxWidth: '640px',
    alignSelf: 'flex-start',
    width: '100%',
    animation: 'fadeInUp 0.25s ease'
  }}>
```

Ensure the border is hardcoded as `'1px solid #D4CFC6'`.
Do NOT apply any computed `cardBorder` variable to this div.
If there is any `cardBorder` computation touching this div, remove it.

Same applies to the loading state div (the `if (!run) return (...)` branch):
```tsx
if (!run) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #D4CFC6',   // ← always this
      borderRadius: '12px',
      ...
    }}>
```

---

### CHANGE 3 — Remove cancelled_by_user special branch from RunCard

**Find this block inside RunCard and DELETE IT ENTIRELY:**
```tsx
if (metadata.cancelled_by_user) {
  return (
    <div style={{
      padding: '8px 16px',
      margin: '8px 0 16px',
      // ... small grey pill rendering
    }}>
      ...
    </div>
  );
}
```

After deletion, cancelled runs fall through to normal RunCard rendering.
The Badge component already handles 'cancelled' status:
- background: #F3F4F6, color: #4B5563, label: 'Cancelled'

---

### CHANGE 4 — RunCard: hide "Show full run" for cancelled and failed runs

The expand/collapse button must not appear when there is nothing to expand.

**Find the "Show full run ↓" / "Know more ↓" button row in RunCard.**
Wrap it so it only renders for completed runs:

```tsx
{/* Only show expand button for completed runs with output */}
{metadata.status === 'completed' && (
  <>
    {!isExpanded && (
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 16px 10px' }}>
        <button
          onClick={onToggle}
          style={{
            fontSize: '12px', fontWeight: 500, color: '#2E5BBA',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif"
          }}
        >
          Show full run ↓
        </button>
      </div>
    )}
    {isExpanded && (
      <>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #D4CFC6' }}>
          {metadata.steps?.map((step, idx) => (
            <StepRow key={idx} step={step} isLast={idx === (metadata.steps?.length ?? 1) - 1} />
          ))}
        </div>
        <div style={{
          padding: '14px 16px', background: '#F7F6F3',
          fontSize: '13px', color: '#1A1916', lineHeight: 1.7, whiteSpace: 'pre-line'
        }}>
          {metadata.full_output}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 16px 10px' }}>
          <button
            onClick={onToggle}
            style={{
              fontSize: '12px', fontWeight: 500, color: '#2E5BBA',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            Close ↑
          </button>
        </div>
      </>
    )}
  </>
)}

{/* Failed: show error reason */}
{metadata.status === 'failed' && metadata.error && (
  <div style={{
    padding: '10px 16px', fontSize: '12px', color: '#991B1B',
    background: '#FEE2E2', borderTop: '1px solid #FECACA'
  }}>
    Failed: {metadata.error}
  </div>
)}

{/* Cancelled: show nothing extra */}
```

---

### CHANGE 5 — Add bottom padding to thread container

The thread div needs enough bottom padding so the last widget is
never flush against the input area.

**Find the thread div with `ref={threadRef}`. Change its padding:**
```tsx
// From:
padding: '20px 24px'

// To:
padding: '20px 24px 48px 24px'
```

---

## Verification checklist

After applying all 5 changes, verify in production:

1. ✅ Click "Run now" → LiveRunWidget appears in thread AND thread scrolls to it
2. ✅ Each poll cycle → thread scrolls to bottom of widget automatically
3. ✅ Widget border is always `#D4CFC6` grey — never amber, never green
4. ✅ Checkpoint appears inline inside widget → user can approve without scrolling away
5. ✅ Run completes → widget disappears after 800ms → RunCard appears in its place
6. ✅ Cancelled RunCards show "Cancelled" badge — no grey pill, no expand button
7. ✅ Completed RunCards show "Show full run ↓" → expands inline → "Close ↑" collapses
8. ✅ New messages from user or agent → thread scrolls to bottom
9. ✅ `npm run build` passes zero errors

---

## What NOT to touch

- Polling logic in `fetchData()` — do not change
- `handleRunNow()`, `handleSendMessage()`, `handleResume()` — do not change
- `activeRunId` state management — do not change
- `onComplete()` callback (1500ms delay before calling) — already correct
- ProfilePanel — do not touch
- Any API routes — do not touch
- Right column / profile panel — do not touch
