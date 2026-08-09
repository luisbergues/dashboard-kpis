# Animación de introducción (video JL Engineering) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current canvas/SVG login-background animation with the provided `JL Engineering Intro.mp4` video, and show that same video as a full-screen, skippable splash on every fresh load of the app (Chrome reopened, or Ctrl+R) — for both logged-in and logged-out users — without touching the auth flow.

**Architecture:** Two small presentational components share one static video asset (`public/jl-engineering-intro.mp4`, already rendered — no animation logic to port). `LoginIntroBackground.jsx` keeps its existing role (persistent background behind the login card, freezes on the last frame because the `<video>` has no `loop`). A new `IntroSplash.jsx` is mounted at the top of `App.jsx`, gated by a `showSplash` state that starts `true` on every mount (React remounts `App` on every full page load, which is exactly the "every Chrome open / every Ctrl+R" trigger the user asked for — no `sessionStorage`, no auth-state changes needed).

**Tech Stack:** React 19, Vite, Vitest + @testing-library/react (existing test setup, no new dependencies).

## Global Constraints

- Spec: [docs/superpowers/specs/2026-08-08-login-intro-animation-design.md](../specs/2026-08-08-login-intro-animation-design.md)
- Video asset must be referenced as `/jl-engineering-intro.mp4` (renamed from `public/JL Engineering Intro.mp4` in Task 1 — no spaces, avoids URL-encoding issues in `<video src>`).
- `<video>` elements: `autoPlay muted playsInline preload="auto"`, **no `loop`** (freeze-on-last-frame is the desired behavior, both for the login background and, implicitly, right before the splash's fade-out starts).
- No test file may rely on `@testing-library/jest-dom` custom matchers (`toHaveAttribute`, `toHaveStyle`, etc.) — this repo's existing tests don't extend jest-dom globally (no `setupFiles` in `vite.config.js`), so use plain DOM property/attribute checks with vitest's built-in `expect` instead, matching the pattern in `src/designer-performance/views/__tests__/Phase1ForceApprove.test.tsx`.
- No commits during implementation — this project's convention (confirmed by the user) is to only commit when explicitly asked. Skip any "commit" step; leave changes staged in the working tree for the user to review and commit themselves.

---

### Task 1: Rename and clean up the animation assets in `public/`

**Files:**
- Rename: `public/JL Engineering Intro.mp4` → `public/jl-engineering-intro.mp4`
- Delete: `public/JL Engineering Intro.html`

**Interfaces:**
- Produces: a video reachable at the URL path `/jl-engineering-intro.mp4` once `npm run dev` or a production build serves `public/`. Tasks 2 and 3 both hardcode this exact path.

- [ ] **Step 1: Rename the video file (remove spaces from the filename)**

```bash
git mv "public/JL Engineering Intro.mp4" "public/jl-engineering-intro.mp4"
```

(The file is currently untracked — if `git mv` errors because it's not yet tracked, use a plain filesystem move instead: `mv "public/JL Engineering Intro.mp4" "public/jl-engineering-intro.mp4"`.)

- [ ] **Step 2: Delete the dev-only exported HTML bundle**

```bash
git rm "public/JL Engineering Intro.html"
```

This file is the 929KB Claude Design export bundle used only to source the video — not needed at runtime. Leaving it in `public/` would make Vite copy it verbatim into every production build.

- [ ] **Step 3: Verify the rename/delete on disk**

Run: `ls public/`
Expected: `jl-engineering-intro.mp4` is present; `JL Engineering Intro.mp4` and `JL Engineering Intro.html` are both gone.

- [ ] **Step 4: Verify the video is servable**

Run: `npm run dev` (leave it running), then in another terminal:
`curl -sI http://localhost:5173/jl-engineering-intro.mp4 | head -5`
Expected: `HTTP/1.1 200 OK` and a `Content-Type: video/mp4` header. Stop the dev server after confirming.

---

### Task 2: `IntroSplash` component (full-screen, skippable intro)

**Files:**
- Create: `src/components/IntroSplash.jsx`
- Test: `src/components/__tests__/IntroSplash.test.jsx`

**Interfaces:**
- Produces: `export default function IntroSplash({ onDone })`. `onDone: () => void` — called exactly once, after the user (or the video ending on its own) triggers skip **and** the opacity fade-out transition finishes. Consumed by `App.jsx` in Task 4.
- Consumes: the video at `/jl-engineering-intro.mp4` (Task 1).

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/IntroSplash.test.jsx`:

```jsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import IntroSplash from '../IntroSplash';

afterEach(() => cleanup());

describe('IntroSplash', () => {
  it('renders the intro video ready to autoplay muted and inline, without looping', () => {
    render(<IntroSplash onDone={() => {}} />);
    const video = screen.getByTestId('intro-splash-video');
    expect(video.src).toContain('/jl-engineering-intro.mp4');
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(false);
    expect(video.getAttribute('playsinline')).not.toBeNull();
  });

  it('does not call onDone just from mounting', () => {
    const onDone = vi.fn();
    render(<IntroSplash onDone={onDone} />);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('starts the fade-out on click, then calls onDone once the fade transition ends', () => {
    const onDone = vi.fn();
    render(<IntroSplash onDone={onDone} />);
    const overlay = screen.getByTestId('intro-splash-overlay');

    fireEvent.click(overlay);
    expect(onDone).not.toHaveBeenCalled(); // fade still in progress
    expect(overlay.style.opacity).toBe('0');

    fireEvent.transitionEnd(overlay);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('starts the fade-out on Escape', () => {
    const onDone = vi.fn();
    render(<IntroSplash onDone={onDone} />);
    const overlay = screen.getByTestId('intro-splash-overlay');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(overlay.style.opacity).toBe('0');

    fireEvent.transitionEnd(overlay);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('starts the fade-out when the video finishes playing on its own', () => {
    const onDone = vi.fn();
    render(<IntroSplash onDone={onDone} />);
    const video = screen.getByTestId('intro-splash-video');
    const overlay = screen.getByTestId('intro-splash-overlay');

    fireEvent.ended(video);
    expect(overlay.style.opacity).toBe('0');

    fireEvent.transitionEnd(overlay);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/__tests__/IntroSplash.test.jsx`
Expected: FAIL — `Cannot find module '../IntroSplash'` (the component doesn't exist yet).

- [ ] **Step 3: Implement `IntroSplash.jsx`**

Create `src/components/IntroSplash.jsx`:

```jsx
import { useState, useEffect } from 'react';

const VIDEO_SRC = '/jl-engineering-intro.mp4';

export default function IntroSplash({ onDone }) {
  const [skipping, setSkipping] = useState(false);

  const handleSkip = () => setSkipping(true);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') handleSkip();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      data-testid="intro-splash-overlay"
      onClick={handleSkip}
      onTransitionEnd={() => { if (skipping) onDone(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: '#020617',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        cursor: 'pointer',
        opacity: skipping ? 0 : 1,
        pointerEvents: skipping ? 'none' : 'auto',
        transition: 'opacity 450ms ease',
      }}
    >
      <video
        data-testid="intro-splash-video"
        src={VIDEO_SRC}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={handleSkip}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/__tests__/IntroSplash.test.jsx`
Expected: PASS (5 tests).

---

### Task 3: Rewrite `LoginIntroBackground` to play the video

**Files:**
- Modify: `src/views/LoginIntroBackground.jsx` (full rewrite — replace the entire canvas/SVG scene with a `<video>`)
- Test: `src/views/__tests__/LoginIntroBackground.test.jsx`

**Interfaces:**
- Produces: `export default function LoginIntroBackground()` — same zero-prop signature as today. Already consumed, unchanged, by `src/views/LoginView.jsx:170` (`<LoginIntroBackground />`) — no edit needed there.
- Consumes: the video at `/jl-engineering-intro.mp4` (Task 1).

- [ ] **Step 1: Write the failing test**

Create `src/views/__tests__/LoginIntroBackground.test.jsx`:

```jsx
// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import LoginIntroBackground from '../LoginIntroBackground';

afterEach(() => cleanup());

describe('LoginIntroBackground', () => {
  it('renders the intro video muted/inline/autoplaying and NOT looping, so it freezes on the last frame once it ends', () => {
    render(<LoginIntroBackground />);
    const video = screen.getByTestId('login-intro-video');
    expect(video.src).toContain('/jl-engineering-intro.mp4');
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(false);
    expect(video.getAttribute('playsinline')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/views/__tests__/LoginIntroBackground.test.jsx`
Expected: FAIL — the current `LoginIntroBackground.jsx` renders the old canvas scene, which has no `data-testid="login-intro-video"` element (`getByTestId` throws `Unable to find an element by: [data-testid="login-intro-video"]`).

- [ ] **Step 3: Replace the component's contents**

Replace the entire contents of `src/views/LoginIntroBackground.jsx` with:

```jsx
const VIDEO_SRC = '/jl-engineering-intro.mp4';

export default function LoginIntroBackground() {
  return (
    <div
      data-testid="login-intro-bg"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#020617' }}
    >
      <video
        data-testid="login-intro-video"
        src={VIDEO_SRC}
        autoPlay
        muted
        playsInline
        preload="auto"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}
```

This removes all of the old `BgGlow`/`BgStars`/`BgTunnel`/`BgParticles`/`BgEmblem`/`BgLockup`/`BgVignette` scene code and the `requestAnimationFrame` clock that drove it — none of it is used anywhere else (`LoginView.jsx` is the only importer of this file), so nothing else needs touching for this deletion to be safe.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/views/__tests__/LoginIntroBackground.test.jsx`
Expected: PASS.

---

### Task 4: Wire `IntroSplash` into `App.jsx` and verify the full flow

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `IntroSplash` from Task 2 (`import IntroSplash from './components/IntroSplash'`; props `{ onDone: () => void }`).

- [ ] **Step 1: Import `IntroSplash`**

In `src/App.jsx`, find this existing import line:

```js
import ViewSkeleton from './components/ViewSkeleton'
```

Add the new import directly below it:

```js
import ViewSkeleton from './components/ViewSkeleton'
import IntroSplash from './components/IntroSplash'
```

- [ ] **Step 2: Add the `showSplash` state**

Find this existing line inside the `App` function body:

```js
  const [authLoading, setAuthLoading] = useState(true);
```

Add the new state directly below it:

```js
  const [authLoading, setAuthLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
```

`showSplash` starts `true` on every mount of `App` — which happens on every full page load (Chrome reopened, Ctrl+R) — so no extra "has this been shown before" check is needed; that's exactly what the spec asked for.

- [ ] **Step 3: Render the splash as the first child of `app-container`**

Find this existing block near the end of the component (the start of the returned JSX):

```jsx
  return (
    <div className="app-container">
      {(!loading && !authLoading && currentUser && (isApproved || isSuperAdmin)) && (
        <Navbar
```

Change it to render `IntroSplash` first:

```jsx
  return (
    <div className="app-container">
      {showSplash && <IntroSplash onDone={() => setShowSplash(false)} />}
      {(!loading && !authLoading && currentUser && (isApproved || isSuperAdmin)) && (
        <Navbar
```

- [ ] **Step 4: Manual verification (App.jsx has no existing automated test coverage — it depends on live Firebase/react-query wiring, consistent with the rest of this codebase)**

Run: `npm run dev`, open the app in a browser.

Check each of these:
1. On first load, the full-screen video splash plays over everything (login screen or dashboard, whichever you're on).
2. Refresh with Ctrl+R while logged out → splash plays again, then reveals the login screen; the login screen's own background is now the same video, frozen on its last frame behind the card.
3. Log in, then refresh with Ctrl+R while logged in → splash plays again over the dashboard, without logging you out.
4. Click anywhere on the splash, or press `Escape` → it fades out immediately (~450ms) instead of waiting for the full 6s.
5. Let the video play to the end without interacting → it fades out on its own once it finishes.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass, including the two new files from Tasks 2 and 3.

---

## Self-Review Notes

- **Spec coverage:** replace login background (Task 3) ✓; full-screen splash on every load (Task 4) ✓; click/Esc skip (Task 2) ✓; asset rename + `.html` cleanup (Task 1) ✓; no `sessionStorage` dedup, no `prefers-reduced-motion` (correctly out of scope, not implemented) ✓.
- **Type/interface consistency:** `IntroSplash({ onDone })` defined in Task 2 is called identically in Task 4 (`<IntroSplash onDone={() => setShowSplash(false)} />}`); `LoginIntroBackground()` keeps its zero-prop signature so `LoginView.jsx` needs no changes; both video components use the same `VIDEO_SRC = '/jl-engineering-intro.mp4'` path established in Task 1.
- **No placeholders:** every step above has runnable code, not a description of code.
