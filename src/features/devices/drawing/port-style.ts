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

