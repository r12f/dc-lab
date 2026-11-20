import { formatGbps } from '../units';
import type { CableMedia, CableType, OpticDefinition } from './types';
import { CABLE_TYPES, isDirectAttach } from './cable-types';
import { genderedConnector } from './connectors';

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

/** Optic reach classes from shortest to longest (coherent ZR last). */
const REACH_ORDER = ['VR', 'SR', 'DR', 'FR', 'LR', 'ER', 'ZR', 'ELS'];

/** Sort key of a reach class: base class order, then lane multiplier (DR4 < 2xDR4 < DR8). */
export function reachOrder(reach: string): number {
  const m = /^(?:(\d+)x)?([A-Z]+?)(\d*)$/i.exec(reach.trim());
  if (!m) return 999;
  const base = REACH_ORDER.indexOf(m[2].toUpperCase());
  const lanes = Number(m[1] ?? 1) * Number(m[3] || 1);
  // Ties on total lanes: split variants (2xDR4) before single-port ones (DR8).
  return (base < 0 ? 99 : base) * 1000 + lanes * 10 + (m[1] ? 0 : 1);
}

/** Top-level sidebar folders: optic modules first, then cable types in this order. */
const CABLE_TYPE_ORDER: CableType[] = ['copper-dac', 'aec', 'aoc', 'power', 'fiber-sm', 'fiber-mm', 'other'];

/** Interface folder of a cable: its end connectors (gendered), `A<->B` when the ends differ. */
export function cableInterface(c: CableMedia): string {
  const [a, b] = [c.ends.a, c.ends.b].map((e) => genderedConnector(e.connector, e.gender));
  return a === b ? a : `${a}<->${b}`;
}

/**
 * Sidebar folder + order for a cable: one top-level folder per cable type (DAC, AEC, AOC, Power, SMF, MMF,
 * Other), then the interface (`OSFP`, `MMC-16F<->MPO-8F`, `C13<->C14`); direct-attach cables then split by
 * speed (low to high); fiber cables list directly under the interface, fewest connectors first.
 */
export function cableTreePlacement(c: CableMedia) {
  const i = CABLE_TYPE_ORDER.indexOf(c.type);
  const iface = cableInterface(c);
  const path = [CABLE_TYPES[c.type] ?? c.type, iface];
  const pathOrder: (number | string)[] = [1 + (i < 0 ? CABLE_TYPE_ORDER.length : i), iface];
  if (isDirectAttach(c.type)) {
    pathOrder[1] = `${String(familyOrder(opticFamily(c.ends.a.connector))).padStart(3, '0')} ${iface}`;
    path.push(c.speedGbps ? formatGbps(c.speedGbps) : 'Other');
    pathOrder.push(c.speedGbps ?? 0);
  }
  const fiber = c.type === 'fiber-sm' || c.type === 'fiber-mm';
  return { path, pathOrder, order: fiber ? `${String(c.ends.a.count * 1000 + c.ends.b.count).padStart(7, '0')} ${c.name}` : c.name };
}

/** Sidebar folder + order for an optic: family, then speed (high to low), items by reach (short to long). */
export function opticTreePlacement(o: OpticDefinition) {
  const family = opticFamily(o.formFactor);
  const speed = o.speedGbps > 0 ? formatGbps(o.speedGbps) : 'Other';
  return {
    path: ['Optic Module', family, speed],
    pathOrder: [0, familyOrder(family), -o.speedGbps],
    // Reach first; same reach groups by form factor, module before pigtail.
    order: `${String(reachOrder(o.reach)).padStart(6, '0')} ${o.formFactor} ${o.packaging === 'pigtail' ? 1 : 0}`,
  };
}
