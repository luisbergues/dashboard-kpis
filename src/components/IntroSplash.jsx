import { useState, useEffect } from 'react';

const VIDEO_SRC = '/jl-engineering-intro.mp4';

// The video runs 6s, but holding the splash open that long on every single
// refresh got in the way of just signing in — cut it short once the logo,
// wordmark and progress bar have fully settled (~3.9s in the source video),
// instead of waiting for the full clip or requiring a manual skip.
const AUTO_SKIP_MS = 4000;

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

  useEffect(() => {
    const timer = setTimeout(handleSkip, AUTO_SKIP_MS);
    return () => clearTimeout(timer);
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
