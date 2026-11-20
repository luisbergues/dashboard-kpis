// Colores para Chart.js (y cualquier otro dibujo en <canvas>).
//
// El canvas no entiende `var(--token)`: necesita el color ya resuelto. Esto
// es un ESPEJO de los tokens de src/index.css (:root = oscuro,
// :root.light-theme = claro). Si cambia la paleta allá, cambiala acá también.
//
// No se lee con getComputedStyle a propósito: ThemeContext cambia la clase de
// <html> en un efecto, DESPUÉS del render, así que en el render del cambio de
// tema el CSS todavía tiene los valores viejos.

const PALETTE = {
  light: {
    bg: '#EEF0EA',
    surface: '#FFFFFF',
    surface2: '#F5F6F2',
    border: '#E1E3DC',
    text: '#1E211F',
    textMuted: '#7A7F78',
    accent: '#2E9E5B',
    accentSoft: '#E6F4EC',
    accentInk: '#1F7A45',
    warn: '#C98A1B',
    danger: '#C2453D',
    grid: 'rgba(30, 33, 31, 0.08)',
  },
  dark: {
    bg: '#111312',
    surface: '#191C1A',
    surface2: '#212522',
    border: '#2C302D',
    text: '#E7EAE5',
    textMuted: '#959B92',
    accent: '#3BB26A',
    accentSoft: 'rgba(59, 178, 106, 0.14)',
    accentInk: '#74D29C',
    warn: '#D99A2B',
    danger: '#DE5A52',
    grid: 'rgba(231, 234, 229, 0.06)',
  },
};

/** @param {boolean} isLight */
export function chartColors(isLight) {
  return isLight ? PALETTE.light : PALETTE.dark;
}

/** Mismo color con otra opacidad (solo hex #RRGGBB). */
export function withAlpha(hex, alpha) {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

/** Tooltip estándar de los gráficos, igual en todas las vistas. */
export function chartTooltip(isLight) {
  const c = chartColors(isLight);
  return {
    backgroundColor: c.surface,
    titleColor: c.accentInk,
    bodyColor: c.text,
    borderColor: c.border,
    borderWidth: 1,
  };
}
