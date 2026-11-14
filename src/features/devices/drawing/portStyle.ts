import type { PortRole, Phase } from '../../../domain/device/types';
import { parseMode } from '../../../domain/device/breakout';

const FANOUT_COLORS: Record<number, string> = { 1: '#475569', 2: '#2563eb', 4: '#16a34a', 8: '#d97706' };

/** Fill for a data port, keyed by breakout fan-out. */
export function modeColor(mode: string): string {
  const m = parseMode(mode);
  return (m && FANOUT_COLORS[m.fanout]) ?? '#9333ea';
}

export const ROLE_COLORS: Record<PortRole, string> = {
  data: '#475569',
  service: '#0891b2',
  mgmt: '#65a30d',
  console: '#a16207',
  outlet: '#1f2937',
};

export const PHASE_COLORS: Record<Phase, string> = {
  L1: '#b45309', L2: '#111827', L3: '#6b7280', 'L1-L2': '#9a3412', 'L2-L3': '#374151', 'L3-L1': '#78716c',
};

/** Short mode text drawn inside a port, e.g. "4x200" (G omitted to save space). */
export function shortMode(mode: string): string {
  return mode.replace(/G$/i, '');
}

/** Stable color for an item id (optic / cable markers). */
export function idColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 45%)`;
}
