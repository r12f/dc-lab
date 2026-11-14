import type { PortRole, Phase } from '../../../domain/device/types';
import { parseMode } from '../../../domain/device/breakout';

/** Light tints so port text (dark) stays readable; the hue only hints the fan-out. */
const FANOUT_COLORS: Record<number, string> = { 1: '#e2e8f0', 2: '#dbeafe', 4: '#dcfce7', 8: '#fef3c7' };

/** Fill for a data port, keyed by breakout fan-out. */
export function modeColor(mode: string): string {
  const m = parseMode(mode);
  return (m && FANOUT_COLORS[m.fanout]) ?? '#f3e8ff';
}

export const ROLE_COLORS: Record<PortRole, string> = {
  data: '#e2e8f0',
  service: '#cffafe',
  mgmt: '#ecfccb',
  console: '#fef3c7',
  laser: '#ffe4e6',
  outlet: '#e5e7eb',
  inlet: '#e5e7eb',
};

export const PHASE_COLORS: Record<Phase, string> = {
  L1: '#b45309', L2: '#111827', L3: '#6b7280', 'L1-L2': '#9a3412', 'L2-L3': '#374151', 'L3-L1': '#78716c',
};

export { speedLabel } from '../../../domain/device/breakout';

/** Stable color for an item id (optic / cable markers). */
export function idColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 45%)`;
}
