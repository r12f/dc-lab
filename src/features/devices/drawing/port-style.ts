import type { PortRole, Phase } from '../../../domain/device/types';
import { parseMode } from '../../../domain/device/breakout';

/** Light tints so port text (dark) stays readable; the hue only hints the fan-out. */
/** Port colors never use red / orange / yellow: those mean error / warning. */
const FANOUT_COLORS: Record<number, string> = { 1: '#e2e8f0', 2: '#dbeafe', 4: '#dcfce7', 8: '#ede9fe' };

/** Fill for a data port, keyed by breakout fan-out. */
export function modeColor(mode: string): string {
  const m = parseMode(mode);
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

export const PHASE_COLORS: Record<Phase, string> = {
  L1: '#1d4ed8', L2: '#111827', L3: '#6b7280', 'L1-L2': '#6d28d9', 'L2-L3': '#374151', 'L3-L1': '#0f766e',
};

export { speedLabel } from '../../../domain/device/breakout';

/**
 * Connector cells (a port's cable legs): an empty cell has no fill of its own (the port's color shows through, so a
 * port is one background), only its outline.
 */
export const LEG_EMPTY = 'none';
export const LEG_LINE = '#94a3b8';

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
