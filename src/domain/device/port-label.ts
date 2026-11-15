import { genderedConnector } from '../optics/connectors';
import { formatGbps } from '../units';
import type { PortGroup } from './types';
import { speedLabel } from './breakout';

/**
 * Interface type and mode of one port: form factor, plus the effective speed when rated.
 * "OSFP 800G", "OSFP 2x400G", "RJ45 1G", "LC", "C13".
 */
/**
 * A port group's connector as shown: fiber connector ports carry the gender of the cable end they take
 * ("MPO-8F" = plug a female end in, "MMC-16M"); cages, RJ45 and power keep the plain form factor.
 */
export function groupConnector(group: PortGroup): string {
  return genderedConnector(group.formFactor, group.cableGender);
}

export function portLabel(group: PortGroup, mode?: string): string {
  const speed = mode ? speedLabel(mode) : group.speedGbps > 0 ? formatGbps(group.speedGbps) : '';
  const c = groupConnector(group);
  return speed ? `${c} ${speed}` : c;
}
