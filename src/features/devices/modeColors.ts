import { parseMode } from '../../domain/device/breakout';

const PALETTE: Record<number, string> = { 1: '#475569', 2: '#2563eb', 4: '#16a34a', 8: '#d97706' };

/** Color for a breakout mode, keyed by fan-out. */
export function modeColor(mode: string): string {
  const m = parseMode(mode);
  return (m && PALETTE[m.fanout]) ?? '#9333ea';
}
