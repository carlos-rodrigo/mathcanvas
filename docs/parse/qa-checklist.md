# QA Checklist — MathCanvas Tutor MVP

> Manual verification checklist for performance, latency, and accessibility.
> Run through this list before each release or demo.

---

## 1. Performance / Latency

### 1.1 Page Load
- [ ] First Contentful Paint (FCP) < 1.5 s on desktop broadband
- [ ] Largest Contentful Paint (LCP) < 2.5 s
- [ ] No layout shift after whiteboard renders (CLS < 0.1)
- [ ] JavaScript bundle size < 200 KB gzipped (check `next build` output)

### 1.2 STT → LLM → TTS Round-Trip
> **Where to measure:** Instrument the full voice loop in the page orchestrator.

| Segment | Where to instrument | Target |
|---|---|---|
| **STT latency** | `SpeechRecognitionService.onResult` callback — measure `Date.now()` from `start()` to first `finalTranscript` | < 1 s after user stops speaking |
| **LLM response time** | Wrap the `fetch` call to the LLM API — measure from request sent to first JSON chunk received | < 3 s (P95) |
| **Payload parse time** | Wrap `parseAssistantPayload()` — measure start to `ok` result | < 5 ms |
| **Canvas render time** | Measure from `APPLY_COMMANDS` dispatch to next `requestAnimationFrame` callback | < 16 ms (one frame) |
| **TTS playback start** | `TTSProvider.onStateChange` — measure from `loading` to `speaking` | < 1.5 s |
| **End-to-end** | From mic button release to first audible TTS syllable | < 5 s target, < 8 s acceptable |

**How to add instrumentation (quick approach):**
```ts
// In your orchestrator / page component:
const t0 = performance.now();
// ... after STT final transcript:
console.log(`[perf] STT: ${performance.now() - t0}ms`);
// ... after LLM response:
console.log(`[perf] LLM: ${performance.now() - t0}ms`);
// ... after TTS starts speaking:
console.log(`[perf] TTS start: ${performance.now() - t0}ms`);
```

### 1.3 Canvas Rendering Performance
- [ ] Drawing 10+ elements doesn't drop below 60 fps
- [ ] `clear` command followed by `draw` batch doesn't cause visible flicker
- [ ] SVG `preserveAspectRatio="xMidYMid meet"` scales correctly on resize
- [ ] Animations (`fadeSliceIn`, `fadeIn`, `popIn`, `drawLine`) complete smoothly

---

## 2. Accessibility / High Contrast

### 2.1 Screen Reader
- [ ] Whiteboard SVG has `role="img"` and `aria-label="Pizarra interactiva"`
- [ ] Phase status bar uses `role="status"` and `aria-live="polite"`
- [ ] Voice control buttons have descriptive `aria-label` attributes:
  - Record: `"Grabar mensaje de voz"`
  - Stop: `"Detener"`
  - Replay: `"Repetir explicación"`
- [ ] Exercise panel has `aria-label="Ejercicio actual"`
- [ ] Disabled buttons have `disabled` attribute (not just visual dimming)

### 2.2 High-Contrast Visual Checks
- [ ] **PieChart**: Filled slices (`#6366f1` indigo) vs. empty slices (`#e2e8f0` light gray) — contrast ratio > 3:1 ✓
- [ ] **PieChart**: White stroke (`#fff`, 2px) between slices provides clear visual separation
- [ ] **FractionBar**: Filled vs. empty segments use same color scheme with stroke borders
- [ ] **TextBubble**: Default text color (`#0f172a`) on background (`#f1f5f9`) — contrast ratio > 7:1 ✓
- [ ] **TextBubble (custom)**: `textColor="#3730a3"` on `backgroundColor="#e0e7ff"` — verify ratio > 4.5:1
- [ ] **NumberLine**: Tick marks use `#64748b` on white — verify readability
- [ ] **NumberLine markers**: Red circles (`#ef4444`) are visible against the line
- [ ] **StepByStep**: Active step has sufficient visual differentiation
- [ ] **Arrow**: Default stroke color visible against white canvas background
- [ ] **Highlight**: Glow/pulse/outline effects don't obscure underlying element text

### 2.3 Dark Mode
- [ ] Header and controls use `dark:` variants for background and text
- [ ] Canvas container border adapts (`dark:border-slate-700`)
- [ ] Error overlay is readable in dark mode
- [ ] Processing spinner is visible in dark mode
- [ ] Exercise panel uses `dark:` variants for indigo palette

### 2.4 Keyboard Navigation
- [ ] All three control buttons (Record, Stop, Replay) are focusable via Tab
- [ ] Focused buttons have a visible focus ring
- [ ] Buttons can be activated via Enter/Space
- [ ] Focus order follows visual order: Record → Stop → Replay

### 2.5 Text Size / Readability
- [ ] TextBubble default fontSize (16px) meets WCAG minimum
- [ ] FractionDisplay fontSize is large enough for numbers to be readable
- [ ] NumberLine tick labels (10px) are legible — consider increasing for younger users
- [ ] Phase status text in header is readable at default viewport width

---

## 3. Functional Smoke Tests (Manual)

### 3.1 Greeting Flow
- [ ] Page loads → greeting phase → auto-draws welcome TextBubble + FractionDisplay
- [ ] Header shows "👋 ¡Hola! Preparando tu clase…" then transitions to speech text

### 3.2 Voice Interaction
- [ ] Pressing Record button transitions to recording phase (button pulses)
- [ ] Pressing Stop during recording transitions to processing (spinner appears)
- [ ] Processing overlay appears over the canvas
- [ ] After processing, canvas updates and TTS plays

### 3.3 Error Handling
- [ ] Error state shows overlay with error message
- [ ] "Reintentar" button resets to greeting state
- [ ] Error from any phase shows the error overlay

### 3.4 Exercise Display
- [ ] Exercise panel appears when exercise data is present
- [ ] Exercise shows question, accepted answer count, and hint
- [ ] Exercise panel hides when no exercise is active

### 3.5 Canvas Commands
- [ ] `draw` adds new element to whiteboard
- [ ] `draw` with existing id replaces the element
- [ ] `clear` without targetId removes all elements (shows empty state)
- [ ] `clear` with targetId removes only that element

---

## 4. Browser Compatibility

- [ ] Chrome 120+ (primary target)
- [ ] Safari 17+ (iOS/macOS — check Web Speech API support)
- [ ] Firefox 120+ (Web Speech API may be limited)
- [ ] Mobile Chrome on Android (touch targets ≥ 44px for control buttons)
- [ ] Mobile Safari on iOS (check viewport scaling with `preserveAspectRatio`)

---

## 5. Notes

- **Automated tests cover**: schema validation, command parsing, canvas rendering, orchestrator state transitions (run `npm run test`)
- **Not yet automated**: STT/LLM/TTS integration latency (requires live API keys), dark mode visual regression, mobile touch interaction
- **Recommended tooling for future**: Lighthouse CI for perf budgets, Playwright for E2E voice flow mocking, axe-core for automated WCAG audits
