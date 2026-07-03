import React, { useEffect, useRef, useState } from 'react';

// Ported from the "JL KPI Dashboards" intro animation designed in Claude Design
// (animations.jsx + intro-bg.jsx). The generic timeline/scrubber engine from
// that project isn't needed here — this reimplements just the looping clock
// and the scene layers as a plain React component.

const B_CYAN = '#37b6ff';
const B_TEAL = '#22e0a3';
const B_INK = '#eef4ff';
const B_BG = '#04060d';

const B_TAU = Math.PI * 2;
const B_CX = 430, B_CY = 360; // shifted left — leaves room for the login card on the right
// The lockup (word + subtitle + progress bar) reaches full opacity at t=4.4,
// the instant before it starts dissolving for the loop transition — freeze
// there so the final resting frame shows the brand text fully formed.
const FREEZE_AT = 4.4;

const b_lerp = (a, b, t) => a + (b - a) * t;
const b_c01 = (v) => Math.max(0, Math.min(1, v));
function b_rnd(seed) { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

const Easing = {
  easeOutCubic: (t) => (--t) * t * t + 1,
  easeOutBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
};

function BgGlow({ t }) {
  const g = 0.5 + 0.5 * Math.sin(t * 1.6);
  return (
    <div style={{ position: 'absolute', inset: 0, background: B_BG, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: -180, top: 320, width: 820, height: 820,
        borderRadius: '50%', opacity: 0.8,
        background: `radial-gradient(circle at 42% 55%, ${B_TEAL}bb, ${B_CYAN}55 44%, transparent 70%)`,
        filter: 'blur(10px)',
      }} />
      <div style={{
        position: 'absolute', right: -200, top: -160, width: 620, height: 620,
        borderRadius: '50%', opacity: 0.4 + g * 0.15,
        background: `radial-gradient(circle, ${B_CYAN}66, transparent 62%)`,
      }} />
    </div>
  );
}

function BgStars({ t, count = 120, opacity = 1 }) {
  const stars = React.useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: b_rnd(i + 1) * 1280, y: b_rnd(i + 2.3) * 720,
    r: 0.5 + b_rnd(i + 5.1) * 1.5, depth: 0.2 + b_rnd(i + 7.7), tw: b_rnd(i + 9.2),
  })), [count]);
  return (
    <div style={{ position: 'absolute', inset: 0, opacity }}>
      {stars.map((s, i) => {
        const drift = (t * 9 * s.depth) % 1320;
        const x = (s.x - drift + 1320) % 1320 - 20;
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.2 + s.tw * B_TAU));
        return (
          <div key={i} style={{
            position: 'absolute', left: x, top: s.y,
            width: s.r * 2, height: s.r * 2, borderRadius: '50%', background: B_INK,
            opacity: tw * s.depth * 0.8, boxShadow: `0 0 ${s.r * 3}px ${B_CYAN}`,
          }} />
        );
      })}
    </div>
  );
}

function BgTunnel({ t, opacity = 1 }) {
  const RINGS = 14, spokes = 24;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity }}>
      <svg width="1280" height="720" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="bgTun" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor={B_CYAN} stopOpacity="0" />
            <stop offset="55%" stopColor={B_CYAN} stopOpacity="0.5" />
            <stop offset="100%" stopColor={B_TEAL} stopOpacity="0.15" />
          </radialGradient>
        </defs>
        {Array.from({ length: spokes }, (_, i) => {
          const a = (i / spokes) * B_TAU, R = 950;
          return <line key={'s' + i} x1={B_CX} y1={B_CY}
            x2={B_CX + Math.cos(a) * R} y2={B_CY + Math.sin(a) * R}
            stroke="url(#bgTun)" strokeWidth="1" />;
        })}
        {Array.from({ length: RINGS }, (_, i) => {
          const phase = ((t * 0.55 + i / RINGS) % 1);
          const scale = Math.pow(phase, 2.2);
          const size = 20 + scale * 1600;
          const o = b_c01((1 - phase) * 1.4) * b_c01(phase * 6);
          return <rect key={'r' + i} x={B_CX - size / 2} y={B_CY - size / 2}
            width={size} height={size} rx={size * 0.06} fill="none"
            stroke={i % 2 ? B_TEAL : B_CYAN} strokeWidth={1 + scale * 1.4}
            opacity={o * 0.55} transform={`rotate(${phase * 12} ${B_CX} ${B_CY})`} />;
        })}
      </svg>
    </div>
  );
}

function BgParticles({ t, appear = 1.4, formed = 3.0, opacity = 1 }) {
  const N = 90;
  const parts = React.useMemo(() => Array.from({ length: N }, (_, i) => ({
    a: (i / N) * B_TAU,
    sx: (b_rnd(i + 3) - 0.5) * 1400, sy: (b_rnd(i + 8) - 0.5) * 1000,
    r: 168 + (b_rnd(i + 11) - 0.5) * 10, sz: 1.5 + b_rnd(i + 4) * 2.5, hue: b_rnd(i + 6),
  })), []);
  const e = Easing.easeInOutCubic(b_c01((t - appear) / (formed - appear)));
  const orbit = Math.max(0, t - formed) * 0.35;
  return (
    <div style={{ position: 'absolute', inset: 0, opacity }}>
      {parts.map((pt, i) => {
        const ang = pt.a + orbit;
        const x = b_lerp(B_CX + pt.sx, B_CX + Math.cos(ang) * pt.r, e);
        const y = b_lerp(B_CY + pt.sy, B_CY + Math.sin(ang) * pt.r, e);
        return <div key={i} style={{
          position: 'absolute', left: x, top: y,
          width: pt.sz, height: pt.sz, borderRadius: '50%',
          background: pt.hue > 0.5 ? B_CYAN : B_TEAL,
          boxShadow: `0 0 ${6 + e * 6}px ${pt.hue > 0.5 ? B_CYAN : B_TEAL}`,
          transform: 'translate(-50%,-50%)', opacity: 0.5 + e * 0.5,
        }} />;
      })}
    </div>
  );
}

function BgEmblem({ t, appear = 2.4, opacity = 1 }) {
  const e = Easing.easeOutBack(b_c01((t - appear) / 0.8));
  const rot = t * 40, pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  const org = `${B_CX}px ${B_CY}px`;
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * B_TAU - Math.PI / 2;
    return `${B_CX + Math.cos(a) * 60},${B_CY + Math.sin(a) * 60}`;
  }).join(' ');
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: opacity * b_c01((t - appear) / 0.4) }}>
      <svg width="1280" height="720" style={{
        position: 'absolute', inset: 0,
        transform: `scale(${b_lerp(0.4, 1, e)})`, transformOrigin: org,
      }}>
        <g style={{ transformOrigin: org, transform: `rotate(${rot}deg)` }}>
          <ellipse cx={B_CX} cy={B_CY} rx="120" ry="120" fill="none" stroke={B_CYAN} strokeWidth="1.5" opacity="0.7" strokeDasharray="4 10" />
        </g>
        <g style={{ transformOrigin: org, transform: `rotate(${-rot * 0.7}deg)` }}>
          <ellipse cx={B_CX} cy={B_CY} rx="120" ry="46" fill="none" stroke={B_TEAL} strokeWidth="1.5" opacity="0.8" />
          <ellipse cx={B_CX} cy={B_CY} rx="46" ry="120" fill="none" stroke={B_CYAN} strokeWidth="1.5" opacity="0.55" />
        </g>
        <polygon points={hex} fill="none" stroke={B_INK} strokeWidth="2"
          style={{
            transformOrigin: org, transform: `rotate(${rot * 1.4}deg)`,
            filter: `drop-shadow(0 0 ${8 + pulse * 14}px ${B_CYAN})`,
          }} />
        <circle cx={B_CX} cy={B_CY} r={10 + pulse * 4} fill={B_CYAN}
          style={{ filter: `drop-shadow(0 0 ${14 + pulse * 20}px ${B_CYAN})` }} />
      </svg>
    </div>
  );
}

function BgLockup({ t, appear = 3.0, opacity = 1 }) {
  const word = 'JL KPI DASHBOARDS';
  const load = b_c01((t - (appear + 0.4)) / 1.0);
  return (
    <div style={{ position: 'absolute', left: 0, right: 420, top: 452, textAlign: 'center', opacity }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        {word.split('').map((ch, i) => {
          const e = Easing.easeOutCubic(b_c01((t - (appear + i * 0.05)) / 0.5));
          return <span key={i} style={{
            fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700,
            fontSize: 46, letterSpacing: '0.1em', color: B_INK, opacity: e,
            transform: `translateY(${(1 - e) * 22}px)`, display: 'inline-block',
            width: ch === ' ' ? 18 : 'auto', textShadow: `0 0 26px ${B_CYAN}66`,
          }}>{ch === ' ' ? ' ' : ch}</span>;
        })}
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: 13, letterSpacing: '0.34em',
        color: B_CYAN, marginTop: 15, textTransform: 'uppercase',
        opacity: b_c01((t - (appear + 0.5)) / 0.6),
      }}>Panel de métricas de ingeniería</div>
      <div style={{
        width: 220, height: 2, margin: '24px auto 0', background: 'rgba(255,255,255,0.12)',
        borderRadius: 2, overflow: 'hidden', opacity: b_c01((t - (appear + 0.4)) / 0.4),
      }}>
        <div style={{
          width: `${load * 100}%`, height: '100%',
          background: `linear-gradient(90deg, ${B_TEAL}, ${B_CYAN})`, boxShadow: `0 0 12px ${B_CYAN}`,
        }} />
      </div>
    </div>
  );
}

function BgVignette({ opacity = 1 }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(120% 120% at 50% 50%, transparent 52%, rgba(0,0,0,0.62))',
      }} />
    </div>
  );
}

function inWindow(t, start, end) { return t >= start && t <= end; }

export default function LoginIntroBackground() {
  const [t, setT] = useState(0);
  const stageRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let raf;
    let last = null;
    const step = (ts) => {
      if (last == null) last = ts;
      const dt = (ts - last) / 1000;
      last = ts;
      let reachedEnd = false;
      setT((prev) => {
        const next = prev + dt;
        if (next >= FREEZE_AT) { reachedEnd = true; return FREEZE_AT; }
        return next;
      });
      if (!reachedEnd) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const s = Math.max(el.clientWidth / 1280, el.clientHeight / 720);
      setScale(s || 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={stageRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: B_BG }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%', width: 1280, height: 720,
        transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center',
      }}>
        <BgGlow t={t} />
        {inWindow(t, 0, 4.6) && <BgVignette opacity={b_c01(1 - (t - 3.0) / 1.2)} />}
        {inWindow(t, 0, 3.4) && (() => {
          const fade = b_c01(1 - (t - 2.4) / 0.9);
          return (<>
            <BgStars t={t} opacity={fade} />
            <BgTunnel t={t} opacity={fade * b_c01(t / 0.4)} />
          </>);
        })()}
        {inWindow(t, 1.4, 5.5) && <BgStars t={t} count={70} opacity={b_c01(1 - (t - 4.4) / 0.8) * 0.4} />}
        {inWindow(t, 1.4, 4.7) && <BgParticles t={t} opacity={b_c01(1 - (t - 4.1) / 0.5)} />}
        {inWindow(t, 2.4, 4.7) && <BgEmblem t={t} opacity={b_c01(1 - (t - 4.1) / 0.5)} />}
        {inWindow(t, 3.0, 5.0) && <BgLockup t={t} opacity={b_c01(1 - (t - 4.4) / 0.45)} />}
      </div>
    </div>
  );
}
