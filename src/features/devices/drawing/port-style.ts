import type { PortRole, Phase } from '../../../domain/device/types';
import { parseMode } from '../../../domain/device/breakout';

/** Light tints so port text (dark) stays readable; the hue only hints the fan-out. */
/** Port colors never use red / orange / yellow: those mean error / warning. */
const FANOUT_COLORS: Record<number, string> = { 1: '#e2e8f0', 2: '#dbeafe', 4: '#dcfce7', 8: '#ede9fe' };
/** Light theme only: unbroken (1x) / unconfigured data ports and power ports a very light grey. */
const LIGHT_PLAIN = '#f5f6f8';

/** Fill for a data port, keyed by breakout fan-out (`light`: the light theme's softer 1x grey). */
export function modeColor(mode: string, light = false): string {
  const m = parseMode(mode);
  if (light && m?.fanout === 1) return LIGHT_PLAIN;
  return (m && FANOUT_COLORS[m.fanout]) ?? '#f3e8ff';
}

export const ROLE_COLORS: Record<PortRole, string> = {
  data: '#e2e8f0',
  service: '#cffafe',
  mgmt: '#ecfccb',
  console: '#e0e7ff',
  laser: '#f3e8ff',
  outlet: '#e5e7eb',
  inlet: '#e5e7eb',
};

/** Fill for a non-pluggable (or unconfigured) port by role (`light`: the light theme's softer greys). */
export function roleColor(role: PortRole, light = false): string {
  return light && (role === 'data' || role === 'outlet' || role === 'inlet') ? LIGHT_PLAIN : ROLE_COLORS[role];
}

export const PHASE_COLORS: Record<Phase, string> = {
  L1: '#1d4ed8', L2: '#111827', L3: '#6b7280', 'L1-L2': '#6d28d9', 'L2-L3': '#374151', 'L3-L1': '#0f766e',
};

export { speedLabel } from '../../../domain/device/breakout';

/**
 * Connector cells (a port's cable legs) per scheme. Light: an empty cell has no fill of its own (the port's color
 * shows through, so a port is one background), a soft outline, dark text, cable colors as tints. Dark (and every
 * dark preset): dark empty cells with light text, cable colors solid.
 */
export interface LegStyle { empty: string; line: string; emptyInk: string; tint(color: string): string }
export const LEG_STYLE: Record<'light' | 'dark', LegStyle> = {
  light: { empty: 'none', line: '#94a3b8', emptyInk: '#0f172a', tint: (c) => cableTint(c) },
  dark: { empty: '#1e293b', line: '#334155', emptyInk: '#e2e8f0', tint: (c) => c },
};

/**
 * A cable color lightened toward white (`amount` 0 = unchanged, 1 = white): connector cells and cable lines use it
 * so a saturated cable color never overpowers the drawing. Solid (not opacity), so overlapping lines stay light.
 * Non-hex colors (CSS variables) come back unchanged.
 */
export function cableTint(color: string, amount = 0.5): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) + (255 - ((n >> s) & 255)) * amount).toString(16).padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}
