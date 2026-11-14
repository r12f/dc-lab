import { formatGbps } from '../units';
import type { OpticDefinition } from './types';

/**
 * Module families shown as one folder. QSFP-DD (double density, 8 lanes) is its own family; the 4-lane
 * QSFP variants (QSFP+, 28, 56, 112) share "QSFP". OSFP variants share "OSFP".
 */
export function opticFamily(formFactor: string): string {
  const f = formFactor.toUpperCase();
  if (f.startsWith('QSFP-DD')) return 'QSFP-DD';
  if (f.startsWith('QSFP')) return 'QSFP';
  if (f.startsWith('OSFP')) return 'OSFP';
  if (f.startsWith('SFP')) return 'SFP';
  return formFactor || 'Other';
}

/** Family folder order: highest-speed families first. */
const FAMILY_ORDER = ['OSFP', 'QSFP-DD', 'QSFP', 'SFP'];

export function familyOrder(family: string): number | string {
  const i = FAMILY_ORDER.indexOf(family);
  return i >= 0 ? i : family;
}

/** Reach classes from shortest to longest (DAC/AOC first, coherent ZR last). */
const REACH_ORDER = ['DAC', 'AOC', 'VR', 'SR', 'DR', 'FR', 'LR', 'ER', 'ZR', 'ELS'];

/** Sort key of a reach class: base class order, then lane multiplier (DR4 < 2xDR4 < DR8). */
export function reachOrder(reach: string): number {
  const m = /^(?:(\d+)x)?([A-Z]+?)(\d*)$/i.exec(reach.trim());
  if (!m) return 999;
  const base = REACH_ORDER.indexOf(m[2].toUpperCase());
  const lanes = Number(m[1] ?? 1) * Number(m[3] || 1);
  // Ties on total lanes: split variants (2xDR4) before single-port ones (DR8).
  return (base < 0 ? 99 : base) * 1000 + lanes * 10 + (m[1] ? 0 : 1);
}

/** Sidebar folder + order for an optic: family, then speed (high to low), items by reach (short to long). */
export function opticTreePlacement(o: OpticDefinition) {
  const family = opticFamily(o.formFactor);
  const speed = o.speedGbps > 0 ? formatGbps(o.speedGbps) : 'Other';
  return {
    path: ['Optics', family, speed],
    pathOrder: [0, familyOrder(family), -o.speedGbps],
    // Reach first; same reach groups by form factor, module before pigtail.
    order: `${String(reachOrder(o.reach)).padStart(6, '0')} ${o.formFactor} ${o.packaging === 'pigtail' ? 1 : 0}`,
  };
}
