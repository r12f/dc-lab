import { formatGbps } from '../units';
import type { PortGroup } from './types';
import { speedLabel } from './breakout';

/**
 * Interface type and mode of one port: form factor, plus the effective speed when rated.
 * "OSFP 800G", "OSFP 2x400G", "RJ45 1G", "LC", "C13".
 */
export function portLabel(group: PortGroup, mode?: string): string {
  const speed = mode ? speedLabel(mode) : group.speedGbps > 0 ? formatGbps(group.speedGbps) : '';
  return speed ? `${group.formFactor} ${speed}` : group.formFactor;
}
