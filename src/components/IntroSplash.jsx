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
