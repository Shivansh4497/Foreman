# Foreman — Design System
**Version:** 1.0.0
**Status:** Locked for v1 build

All values in this file are absolute. @builder must reference this file for every frontend decision.
No hardcoded colors. No invented values. No deviations without explicit human approval.

---

## Typography

```css
/* Import */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display:ital@0;1&display=swap');

/* Heading font — used for page titles, hero headings only */
font-family: 'DM Serif Display', serif;

/* Body font — used for everything else */
font-family: 'DM Sans', sans-serif;
```

### Type scale

| Usage | Font | Size | Weight | Letter spacing |
|---|---|---|---|---|
| Page heading (h1) | DM Serif Display | 22–26px | 400 | -0.4px |
| Section heading (h2) | DM Sans | 15–16px | 600 | -0.2px |
| Label / subheading | DM Sans | 13–14px | 600 | -0.2px |
| Body text | DM Sans | 13–14px | 400 | normal |
| Small / meta | DM Sans | 12px | 400–500 | normal |
| Micro / uppercase label | DM Sans | 10–11px | 600 | 0.4–0.6px |

### Uppercase labels
All UPPERCASE labels use: `font-size: 10–11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;`
Used for: stat labels, section labels, step type badges, field labels inside cards.

---

## Color Palette

### Background & surface

```css
--bg:       #F7F6F3;  /* Page background — warm off-white */
--surface:  #FFFFFF;  /* Cards, panels, modals */
--surface2: #F0EEE9;  /* Hover states, secondary surfaces, user message bubbles */
--border:   #D4CFC6;  /* All borders — cards, inputs, dividers */
```

### Text

```css
--text-primary:   #1A1916;  /* All headings, primary body text, labels */
--text-secondary: #4A4845;  /* Body text, descriptions, secondary labels */
--text-tertiary:  #7A7770;  /* Timestamps, meta info, placeholder text, muted labels */
```

### Accent (Slate blue — Foreman's brand color)

```css
--accent:       #2E5BBA;  /* Primary interactive elements, links, active states */
--accent-mid:   #4A73CC;  /* Hover states on accent elements */
--accent-light: #EEF2FB;  /* Accent backgrounds — Scout bubbles, checkpoint headers, selected states */
--accent-border: #C5D4F0; /* Borders on accent-light surfaces */
```

### Semantic colors

```css
/* Green — success, auto steps, active status */
--green:    #1A7A4A;
--green-bg: #EAF5EE;
--green-border: #B8DFC8;

/* Amber — review/checkpoint steps, waiting status, test banner */
--amber:    #8A5C00;
--amber-bg: #FEF3DC;
--amber-border: #F5D98A;

/* Red — errors, failed states, danger actions */
--red:      #991B1B;
--red-bg:   #FEE2E2;
--red-border: #FECACA;
```

---

## Spacing

| Token | Value | Usage |
|---|---|---|
| xs | 4px | Gap between inline elements, tight padding |
| sm | 8px | Gap between related elements |
| md | 12–14px | Standard padding inside cards, input padding |
| lg | 16–20px | Section padding, panel padding |
| xl | 24–28px | Page-level padding |
| 2xl | 32–40px | Hero sections, large gaps |

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| pill | 100px | Status badges, quick reply buttons, tab pills |
| lg | 12–14px | Modals, large cards |
| md | 9–10px | Standard cards, agent cards, step cards |
| sm | 7–8px | Inputs, small buttons, step rows |
| xs | 6px | Edit buttons, small badges |
| circle | 50% | Avatars, status dots, step number circles |

---

## Buttons

### Primary button (dark fill)
```css
padding: 9–13px 18–20px;
font-size: 13–15px;
font-weight: 500;
color: #FFFFFF;
background: #1A1916;
border: none;
border-radius: 8–10px;
cursor: pointer;
transition: opacity 0.15s;

:hover { opacity: 0.85; }
:disabled { opacity: 0.3; cursor: default; }
```

### Secondary button (outlined)
```css
padding: 7–9px 14–20px;
font-size: 12–14px;
font-weight: 500;
color: #4A4845;
background: #FFFFFF;
border: 1px solid #D4CFC6;
border-radius: 7–8px;
cursor: pointer;
transition: border-color 0.15s, color 0.15s;

:hover { border-color: #7A7770; color: #1A1916; }
```

### Accent button (blue)
```css
background: #2E5BBA;
color: #FFFFFF;
border: none;
/* Used for upgrade CTA only */
```

### Danger button
```css
color: #991B1B;
background: #FEE2E2;
border: 1px solid #FECACA;
```

### Ghost / nav button
```css
background: none;
border: none;
color: #4A4845;
font-weight: 500;
:hover { color: #1A1916; }
```

### Small edit button (used inside step rows)
```css
display: flex;
align-items: center;
justify-content: center;
height: 26px;
padding: 0 11px;
font-size: 11px;
font-weight: 500;
color: #4A4845;
background: #F7F6F3;
border: 1px solid #D4CFC6;
border-radius: 6px;

:hover { border-color: #2E5BBA; color: #2E5BBA; }
```

---

## Status Badges

All badges use `display: inline-flex; align-items: center; gap: 5px; padding: 3–4px 9–10px; border-radius: 100px; font-size: 11px; font-weight: 600;`

| Status | Background | Text color | Border |
|---|---|---|---|
| Active | #EAF5EE | #1A7A4A | none |
| Running | #EEF2FB | #2E5BBA | none |
| Awaiting review | #FEF3DC | #8A5C00 | none |
| Paused | #F0EEE9 | #7A7770 | none |
| Failed | #FEE2E2 | #991B1B | none |
| Complete | #EAF5EE | #1A7A4A | none |

### Status dot
```css
width: 5px;
height: 5px;
border-radius: 50%;
background: currentColor;

/* Pulse animation for Running state */
animation: pulse 1.2s ease-in-out infinite;
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
```

---

## Step / Tag Badges

Used inside workflow steps, blueprints, review screens.

```css
/* Base */
font-size: 10px;
font-weight: 600;
padding: 2px 7px;
border-radius: 4px;
letter-spacing: 0.3px;
text-transform: uppercase;

/* Auto */
background: #EAF5EE;
color: #1A7A4A;

/* Review / Checkpoint */
background: #FEF3DC;
color: #8A5C00;
```

---

## Form Inputs

**CRITICAL:** All inputs must have explicit color and background set to beat dark mode injection.
Never rely on browser defaults.

```css
/* Text input */
width: 100%;
padding: 9px 12px;
border: 1.5px solid #D4CFC6;
border-radius: 8px;
font-family: 'DM Sans', sans-serif;
font-size: 13px;
color: #1A1916 !important;
background: #FFFFFF !important;
-webkit-text-fill-color: #1A1916 !important;
outline: none;
box-sizing: border-box;

:focus { border-color: #2E5BBA; }

/* Textarea */
/* Same as above, plus: */
resize: vertical;
min-height: 68px;
line-height: 1.5;

/* Select */
appearance: none;
background-image: url("data:image/svg+xml,...chevron...");
background-repeat: no-repeat;
background-position: right 12px center;
padding-right: 32px;
```

---

## Cards

### Standard card
```css
background: #FFFFFF;
border: 1px solid #D4CFC6;
border-radius: 10px;
```

### Checkpoint / accent card
```css
background: #FFFFFF;
border: 1.5px solid #C5D4F0;
border-radius: 10px;
```

### Background card (inside panels)
```css
background: #F7F6F3;
border: 1px solid #D4CFC6;
border-radius: 9px;
padding: 12–14px;
```

---

## Navigation Sidebar

```css
width: 200px;
background: #FFFFFF;
border-right: 1px solid #D4CFC6;
padding: 16px 0;
display: flex;
flex-direction: column;
gap: 2px;
```

### Logo area
```css
padding: 0 14px 14px;
border-bottom: 1px solid #D4CFC6;
margin-bottom: 6px;
```

### Logo mark
```css
width: 26px;
height: 26px;
background: #1A1916;
border-radius: 6px;
```

### Nav item
```css
display: flex;
align-items: center;
gap: 8px;
padding: 7px 14px;
font-size: 12px;
font-weight: 500;
color: #4A4845;
border: none;
background: none;
width: 100%;
text-align: left;

:hover { color: #1A1916; background: #F0EEE9; }
.active { color: #1A1916; background: #F0EEE9; }
```

---

## Page Layouts

### Dashboard (with sidebar)
```css
display: grid;
grid-template-columns: 200px 1fr;
min-height: 100vh;
```

### Scout Create Agent (no sidebar, full width split)
```css
/* Top nav only — no sidebar */
display: grid;
grid-template-columns: 1fr 1fr;
height: calc(100vh - topnav height);
```

### Review & Hire (with sidebar)
```css
display: grid;
grid-template-columns: 200px 1fr;
/* Main area: */
display: grid;
grid-template-columns: 1fr 300px;
```

### Agent Conversation (with sidebar)
```css
display: grid;
grid-template-columns: 200px 1fr;
/* Profile panel: full width over main area, sidebar stays */
```

### Run view (with sidebar)
```css
display: grid;
grid-template-columns: 200px 1fr;
/* Main area: */
display: grid;
grid-template-columns: 280px 1fr;
```

---

## Top Navigation Bar

Used on focused flow screens (Scout, Review & Hire, Run view).

```css
display: flex;
align-items: center;
justify-content: space-between;
padding: 10px 20px;
background: #FFFFFF;
border-bottom: 1px solid #D4CFC6;
```

---

## Scout Conversation Panel

### Chat bubble — Scout
```css
background: #EEF2FB;
border: 1px solid #C5D4F0;
color: #1A1916;
padding: 11–12px 14–16px;
border-radius: 10px;
font-size: 13–14px;
line-height: 1.55–1.6;
align-self: flex-start;
max-width: 88%;
```

### Chat bubble — User
```css
background: #F0EEE9;
border: 1px solid #D4CFC6;
color: #1A1916;
align-self: flex-end;
```

### Scout label above bubble
```css
font-size: 10px;
font-weight: 600;
letter-spacing: 0.4px;
text-transform: uppercase;
color: #2E5BBA; /* Scout */
color: #7A7770; /* User */
```

### Typing indicator
```css
/* Three dots, each: */
width: 5px; height: 5px; border-radius: 50%; background: #2E5BBA;
animation: tdot 1.2s ease-in-out infinite;
/* Delays: 0s, 0.2s, 0.4s */
@keyframes tdot { 0%,60%,100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-4px); opacity: 1; } }
```

### Chat input area
```css
background: #F7F6F3;
border: 1.5px solid #D4CFC6;
border-radius: 10px;
padding: 9–10px 12–14px;
```

### Send button
```css
width: 28–30px; height: 28–30px;
background: #1A1916;
border: none; border-radius: 6–7px;
/* SVG arrow icon — white, stroke-width: 2.5 */
```

---

## Workforce Blueprint Panel

### Meta bubbles (Schedule, Output, Steps)
```css
display: grid;
grid-template-columns: 1fr 1fr 1fr;
gap: 8px;
padding: 10px 16px;
background: #FFFFFF;
border-bottom: 1px solid #D4CFC6;

/* Each bubble */
padding: 8px 10px;
background: #F7F6F3;
border: 1px solid #D4CFC6;
border-radius: 8px;
```

### Live indicator
```css
/* Green dot — pulsing */
width: 5px; height: 5px;
background: #1A7A4A;
border-radius: 50%;
animation: livepulse 2s ease-in-out infinite;
@keyframes livepulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

font-size: 11px; font-weight: 500; color: #1A7A4A;
```

### Step row (blueprint)
```css
display: flex;
align-items: center;
gap: 9–10px;
padding: 10–12px 12–14px;
background: #FFFFFF;
border: 1px solid #D4CFC6;
border-radius: 8–9px;

/* Checkpoint step */
border-color: #C5D4F0;
```

### Step number circle
```css
width: 20–24px; height: 20–24px;
border-radius: 50%;
background: #F0EEE9;
color: #7A7770;
font-size: 10–11px; font-weight: 600;

/* Checkpoint */
background: #EEF2FB;
color: #2E5BBA;
```

---

## Checkpoint UI

### Inline checkpoint (in conversation / run view)
```css
background: #FFFFFF;
border: 1.5px solid #C5D4F0;
border-radius: 10px;
overflow: hidden;

/* Header */
padding: 10–12px 14–16px;
background: #EEF2FB;
border-bottom: 1px solid #C5D4F0;
font-size: 12–13px; font-weight: 600; color: #2E5BBA;

/* Body */
padding: 12–16px;
```

### Quick reply buttons
```css
/* Standard */
padding: 6–7px 12–14px;
font-size: 12px; font-weight: 500;
color: #4A4845; background: #F7F6F3;
border: 1px solid #D4CFC6;
border-radius: 100px;
:hover { border-color: #2E5BBA; color: #2E5BBA; }

/* Loop back (search again) */
color: #8A5C00; background: #FEF3DC;
border: 1px solid #F5D98A;
:hover { background: #FDE68A; }
```

---

## Run View

### Step sidebar item
```css
display: flex;
align-items: center;
gap: 10px;
padding: 9px 16px;

/* Active step */
background: #EEF2FB;
```

### Step status circles
```css
width: 20px; height: 20px; border-radius: 50%;

/* Pending */    background: #F0EEE9; color: #7A7770;
/* Running */    background: #EEF2FB; border: 2px solid #2E5BBA; /* + spinner inside */
/* Complete */   background: #EAF5EE; color: #1A7A4A;
/* Checkpoint */ background: #FEF3DC; color: #8A5C00;
/* Failed */     background: #FEE2E2; color: #991B1B;
```

### Spinner
```css
width: 14px; height: 14px;
border: 2px solid #EEF2FB;
border-top-color: #2E5BBA;
border-radius: 50%;
animation: spin 1s linear infinite;
@keyframes spin { to { transform: rotate(360deg); } }
```

### Output card
```css
background: #FFFFFF;
border: 1px solid #D4CFC6;
border-radius: 10px;
overflow: hidden;

/* Header */
padding: 11–12px 16px;
border-bottom: 1px solid #D4CFC6;

/* Body */
padding: 12–14px 16px;
font-size: 13px; color: #4A4845; line-height: 1.6;
```

### Cost bar
```css
display: flex;
gap: 12px;
padding: 12px 16px;
background: #FFFFFF;
border: 1px solid #D4CFC6;
border-radius: 10px;
```

### Memory update tag
```css
display: inline-flex;
align-items: center;
gap: 6px;
padding: 4–6px 10–12px;
background: #EAF5EE;
border: 1px solid #B8DFC8;
border-radius: 6–8px;
font-size: 11–12px; color: #1A7A4A; font-weight: 500;
```

### Error box
```css
background: #FEE2E2;
border: 1px solid #FECACA;
border-radius: 10px;
padding: 16px;
```

### Test run banner
```css
background: #FEF3DC;
border-bottom: 1px solid #F5D98A;
padding: 8px 20px;
font-size: 12px; color: #8A5C00; font-weight: 500;
```

---

## Agent Conversation Screen

### Run divider
```css
display: flex;
align-items: center;
gap: 10px;
margin: 8–14px 0;

/* Line */
flex: 1; height: 1px; background: #D4CFC6;

/* Label */
font-size: 11px; font-weight: 600; color: #7A7770;
```

### Agent avatar (in conversation)
```css
width: 28–32px; height: 28–32px;
background: #1A1916;
border-radius: 7–8px;
font-size: 13–16px;
```

### Output bubble (final post in conversation)
```css
background: #F7F6F3;
border: 1px solid #D4CFC6;
border-radius: 8px;
padding: 12–14px;
font-size: 13px; color: #1A1916; line-height: 1.7;
white-space: pre-line;
```

---

## Modals

```css
background: #FFFFFF;
border: 1px solid #D4CFC6;
border-radius: 14px;
max-width: 440–480px;
width: 100%;
box-shadow: 0 8px 40px rgba(0,0,0,0.13);

/* Overlay */
position: fixed; inset: 0;
background: rgba(26,25,22,0.45);
display: flex; align-items: center; justify-content: center;
z-index: 100;

/* Header */
padding: 15–16px 20px;
border-bottom: 1px solid #D4CFC6;

/* Body */
padding: 18px 20px;
display: flex; flex-direction: column; gap: 12–13px;

/* Footer */
padding: 12px 20px;
border-top: 1px solid #D4CFC6;
display: flex; gap: 8px; justify-content: flex-end;

/* Background blur when modal is open */
filter: blur(2px) brightness(0.97);
pointer-events: none;
```

---

## Profile Panel

### Hero section
```css
display: flex;
align-items: center;
gap: 16–20px;
padding: 18–24px 20px;
border-bottom: 1px solid #D4CFC6;
```

### Large agent avatar
```css
width: 48–56px; height: 48–56px;
background: #1A1916;
border-radius: 12–14px;
font-size: 22–28px;
```

### Stats grid
```css
display: grid;
grid-template-columns: repeat(4, 1fr);
gap: 10–12px;
padding: 14–20px 20px;
border-bottom: 1px solid #D4CFC6;
```

### Profile tabs
```css
padding: 0 20px;
border-bottom: 1px solid #D4CFC6;

.tab {
  padding: 9–10px 14–16px;
  font-size: 13px; font-weight: 500;
  color: #7A7770;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tab.active { color: #1A1916; border-bottom-color: #1A1916; }
```

### Memory item
```css
padding: 10px 12px;
background: #F7F6F3;
border: 1px solid #D4CFC6;
border-radius: 8px;
margin-bottom: 7–8px;

.type { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: #7A7770; }
.text { font-size: 12–13px; color: #1A1916; line-height: 1.5; }
```

---

## Onboarding

### Auth card
```css
background: #FFFFFF;
border: 1px solid #D4CFC6;
border-radius: 16px;
padding: 48px 40px;
max-width: 420–480px;
box-shadow: 0 4px 24px rgba(0,0,0,0.07);
```

### Google sign-in button
```css
/* Dark filled — NEVER ghost/outlined */
display: flex; align-items: center; justify-content: center; gap: 12px;
width: 100%; padding: 13–14px;
font-size: 15px; font-weight: 500;
color: #FFFFFF;
background: #1A1916;
border: none;
border-radius: 10px;

/* Google logo sits in white circle */
.google-icon-wrap {
  width: 20px; height: 20px;
  background: #FFFFFF; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
```

### Provider card
```css
border: 1.5px solid #D4CFC6;
border-radius: 10px;
padding: 16px;
cursor: pointer;

.selected { border-color: #2E5BBA; background: #EEF2FB; }
:hover { border-color: #2E5BBA; background: #EEF2FB; }
```

### Progress dots
```css
.dot { width: 6px; height: 6px; border-radius: 50%; background: #D4CFC6; }
.dot.active { background: #1A1916; width: 18px; border-radius: 3px; }
```

### Security badge
```css
display: flex; align-items: center; gap: 8px;
padding: 10px 12px;
background: #EAF5EE;
border: 1px solid #B8DFC8;
border-radius: 8px;
font-size: 12px; color: #1A7A4A; font-weight: 500;
```

---

## Settings

### Tab row
```css
display: flex;
border-bottom: 1px solid #D4CFC6;

.tab {
  padding: 8–10px 16px;
  font-size: 13px; font-weight: 500;
  color: #7A7770;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.tab.active { color: #1A1916; border-bottom-color: #1A1916; }
```

### Usage hero
```css
background: #FFFFFF;
border: 1px solid #D4CFC6;
border-radius: 12px;
padding: 20px;

.headline { font-size: 22px; font-weight: 600; letter-spacing: -0.5px; }
```

### Upgrade card
```css
background: #EEF2FB;
border: 1px solid #C5D4F0;
border-radius: 12px;
padding: 20px;
```

---

## Animations & Transitions

```css
/* Standard transition */
transition: all 0.15s;
transition: color 0.15s, background 0.15s, border-color 0.15s;
transition: opacity 0.15s;

/* Page/panel fade in */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
animation: fadeIn 0.25s ease;

/* Pulse (status dots, live indicators) */
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

/* Spinner */
@keyframes spin { to { transform: rotate(360deg); } }

/* Typing dots */
@keyframes tdot {
  0%,60%,100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}
```

---

## Shadows

```css
/* Card shadow — used on auth cards, modals */
box-shadow: 0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04);

/* Modal shadow */
box-shadow: 0 8px 40px rgba(0,0,0,0.13);
```

---

## Screens Reference

All 29+ screens designed. Files live in SOT/screens/.

| Screen | File |
|---|---|
| Landing page | screens/01-landing.html |
| Sign in | screens/02-signin.html |
| Provider selection | screens/03-provider.html |
| API key setup | screens/04-apikey.html |
| Dashboard — empty | screens/05-dashboard-empty.html |
| Dashboard — populated | screens/06-dashboard-populated.html |
| Scout — empty | screens/07-scout-empty.html |
| Scout — building | screens/08-scout-building.html |
| Scout — complete | screens/09-scout-complete.html |
| Review & Hire | screens/10-review-hire.html |
| Review & Hire — edit modal | screens/11-review-edit-modal.html |
| Test run — initialising | screens/12-testrun-init.html |
| Test run — running | screens/13-testrun-running.html |
| Test run — checkpoint | screens/14-testrun-checkpoint.html |
| Test run — complete | screens/15-testrun-complete.html |
| Test run — failed | screens/16-testrun-failed.html |
| Test run — output review | screens/17-testrun-output.html |
| Agent run — initialising | screens/18-run-init.html |
| Agent run — running | screens/19-run-running.html |
| Agent run — checkpoint | screens/20-run-checkpoint.html |
| Agent run — checkpoint loop | screens/21-run-checkpoint-loop.html |
| Agent run — complete | screens/22-run-complete.html |
| Agent run — failed | screens/23-run-failed.html |
| Agent conversation | screens/24-agent-convo.html |
| Agent conversation — checkpoint | screens/25-agent-convo-checkpoint.html |
| Agent profile | screens/26-agent-profile.html |
| Agent profile — workflow edit | screens/27-agent-profile-workflow.html |
| Settings — account | screens/28-settings-account.html |
| Settings — API key | screens/29-settings-apikey.html |
| Settings — usage | screens/30-settings-usage.html |
| Settings — billing | screens/31-settings-billing.html |
