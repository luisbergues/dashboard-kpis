/**
 * Shared design tokens for the designer-performance module.
 *
 * Previously each view (ProjectDetailsModal, Phase1Form, Phase2Form) had its
 * own local `const T = {...}` copying the *dark*-theme hex values. That froze
 * the module in dark mode: none of it reacted to the app's light/dark theme
 * toggle, so text and surfaces went invisible in light theme.
 *
 * Fix: resolve surface/text tokens through the app's CSS custom properties
 * (defined in src/index.css and overridden under :root.light-theme), which
 * work fine in inline styles and update automatically when the theme class
 * changes. Only true semantic/status colors (blue/green/yellow/red) stay as
 * fixed hex — those aren't theme-dependent.
 */
export const T = {
  cardBg: 'var(--card-bg)',
  cardBorder: 'var(--card-border)',
  cardHover: 'var(--card-hover)',
  bgDeep: 'var(--bg-deep)',
  bgSurface: 'var(--bg-surface)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  blue: '#3B82F6',
  blueDeep: '#1D4ED8',
  green: '#10B981',
  yellow: '#EAB308',
  red: '#EF4444',
  radiusLg: 28,
  radiusMd: 20,
  radiusPill: 100,
};
