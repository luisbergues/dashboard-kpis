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
