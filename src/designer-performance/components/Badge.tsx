import React from 'react';

interface BadgeProps {
  score: number;
}

interface BadgeTier {
  min: number;
  label: string;
  color: string;
}

// Ordered from best to worst; the first tier whose `min` the score meets or
// exceeds wins. Colors ramp green -> lime -> yellow -> orange -> red so the
// badge reads as a gradient of performance, not just three buckets.
const TIERS: BadgeTier[] = [
  { min: 90, label: 'Excellent', color: '#22C55E' },
  { min: 80, label: 'Very Good', color: '#84CC16' },
  { min: 70, label: 'Acceptable', color: '#EAB308' },
  { min: 60, label: 'Needs Work', color: '#F97316' },
  { min: 0, label: 'Critical', color: '#EF4444' },
];

export const Badge: React.FC<BadgeProps> = ({ score }) => {
  const tier = TIERS.find(t => score >= t.min) ?? TIERS[TIERS.length - 1];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '100px',
        fontSize: '0.72rem',
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        color: tier.color,
        background: `${tier.color}1A`,
        border: `1px solid ${tier.color}4D`,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: tier.color,
          flexShrink: 0,
        }}
      />
      {tier.label}
    </span>
  );
};
