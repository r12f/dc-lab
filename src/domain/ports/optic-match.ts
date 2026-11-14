import type { Library } from '../library/library';
import type { PortGroup } from '../device/types';
import type { CableMedia, OpticDefinition } from '../optics/types';
import { parseMode } from '../device/breakout';
import { formFactorSpec, heatSinkOf, moduleFits } from './form-factors';
import { connectorsMate } from '../optics/connectors';
import { isDirectAttach } from '../optics/cable-types';

/** Total port speed of a breakout mode ("2x400G" -> 800). */
export function modeTotalGbps(mode: string): number {
  const m = parseMode(mode);
  return m ? m.fanout * m.speedGbps : 0;
}

/** True when the group is a CPO/NPO fiber port (no pluggable module). */
export function isEnginePort(group: PortGroup): boolean {
  return !!group.opticalEngine || formFactorSpec(group.formFactor).kind === 'fiber';
}

/** A transceiver fits a cage: form factor accepted and the same heat sink (IHS / RHS never mix). */
export function opticFitsCage(group: PortGroup, o: OpticDefinition): boolean {
  return moduleFits(group.formFactor, o.formFactor) && heatSinkOf(group) === heatSinkOf(o);
}

/** Modules that fit the cage and run at the mode's total speed. */
export function compatibleOptics(lib: Library, group: PortGroup, mode: string): OpticDefinition[] {
  if (isEnginePort(group)) return [];
  // Laser-source cages carry no data rate: any module of the cage form factor fits.
  if (group.role === 'laser') return lib.optics.items().filter((o) => opticFitsCage(group, o));
  const total = modeTotalGbps(mode);
  return lib.optics.items().filter((o) => opticFitsCage(group, o) && o.speedGbps === total);
}

/** Reach classes that are direct-attach cables, not transceivers. */
const DIRECT_REACH: Record<string, CableMedia['type']> = { DAC: 'copper-dac', AEC: 'aec', AOC: 'aoc' };

/** The direct-attach cable type a reach class stands for ("DAC" -> copper-dac), if any. */
export function directAttachType(reach: string | undefined): CableMedia['type'] | undefined {
  return reach ? DIRECT_REACH[reach.toUpperCase()] : undefined;
}

/** DAC / AEC / AOC cables whose plug fits the cage and whose speed matches the mode. */
export function directAttachCables(lib: Library, group: PortGroup, mode: string, reach?: string): CableMedia[] {
  if (isEnginePort(group) || group.role === 'laser') return [];
  const total = modeTotalGbps(mode);
  const type = directAttachType(reach);
  return lib.cableMedia.items().filter((c) => isDirectAttach(c.type) && (!type || c.type === type)
    && c.speedGbps === total && moduleFits(group.formFactor, c.ends.a.connector));
}

/**
 * Module type of a reach class: variants of one optical interface share a type — "2xDR4+" (2 km), "2xDR4 LPO"
 * are 2xDR4, "DR4-2" is DR4 — and the 4-lane parallel SMF family is one type: PSM4 at <= 100G, DR4 above.
 * Matching key only; show it with `moduleTypeLabel`.
 */
export function moduleType(reach: string | undefined): string | undefined {
  if (!reach) return undefined;
  const t = reach.trim().replace(/[\s-].*$/, '').replace(/\+$/, '');
  return t.replace(/PSM4$/i, 'DR4');
}

/** Name of a module type on a port: the 4-lane parallel SMF type is PSM4 on <= 100G ports, DR4 above. */
export function moduleTypeLabel(type: string | undefined, portSpeedGbps: number): string | undefined {
  return type === 'DR4' && portSpeedGbps <= 100 ? 'PSM4' : type;
}

/**
 * Modules of one type for a cage: the cage takes the form factor (QSFP-DD takes QSFP56/28; QSFP28 does not
 * take QSFP-DD), same module type, speed <= the physical port speed. Fastest first.
 */
export function modulesOfType(lib: Library, group: PortGroup, type: string): OpticDefinition[] {
  if (isEnginePort(group)) return [];
  const t = moduleType(type);
  return lib.optics.items()
    .filter((o) => opticFitsCage(group, o) && o.speedGbps <= group.speedGbps && moduleType(o.reach) === t)
    .sort((a, b) => b.speedGbps - a.speedGbps || a.name.localeCompare(b.name));
}

/**
 * Module types available for a port: engine reaches for CPO/NPO; otherwise the types of every module the cage
 * takes at <= port speed, plus DAC / AEC / AOC when a direct-attach cable of that kind fits the cage at the mode.
 */
export function reachOptions(lib: Library, group: PortGroup, mode: string): string[] {
  if (isEnginePort(group)) return group.reaches ?? [];
  const direct = Object.keys(DIRECT_REACH).filter((r) => directAttachCables(lib, group, mode, r).length);
  const types = lib.optics.items()
    .filter((o) => o.reach && opticFitsCage(group, o) && o.speedGbps <= group.speedGbps)
    .map((o) => moduleTypeLabel(moduleType(o.reach), group.speedGbps)!);
  return [...new Set([...direct, ...types])];
}

/**
 * The module used on a port: a pinned module if it fits cage + speed (+ reach when set),
 * otherwise the first catalog module matching cage + speed + reach.
 */
export function pickOptic(lib: Library, group: PortGroup, mode: string, reach?: string, opticId?: string): OpticDefinition | undefined {
  if (opticId) {
    // A pinned module: of the chosen type when one is set, else any the cage takes at <= port speed.
    const pinned = lib.optics.get(opticId);
    const ok = pinned && opticFitsCage(group, pinned) && pinned.speedGbps <= group.speedGbps
      && (!reach || moduleType(pinned.reach) === moduleType(reach));
    if (ok) return pinned;
  }
  // DAC / AEC / AOC: the cable plugs into the cage itself, no transceiver.
  if (!reach || directAttachType(reach)) return undefined;
  // Auto: the module of that type running the mode's speed, else the fastest of that type the port takes.
  // Among equals: the plain pluggable module over pigtail / LPO variants, then the exact reach.
  const total = modeTotalGbps(mode);
  const rank = (o: OpticDefinition) => (o.packaging === 'pigtail' ? 4 : 0) + (/LPO/i.test(o.reach) ? 2 : 0) + (o.reach === reach ? 0 : 1);
  const of = modulesOfType(lib, group, reach);
  const atSpeed = of.filter((o) => o.speedGbps === total).sort((a, b) => rank(a) - rank(b));
  return atSpeed[0] ?? of[0];
}

/**
 * Cable connector a reach class implies (one per module leg): parallel optics (DR4, PSM4, SR4, DR8, SR8 and
 * their 2x variants) use MPO (MPO-8 / MPO-12 mate; 8-lane = MPO-16); duplex optics (DR1, FR4, LR4, ER4, ZR,
 * SR/LR/ER of SFP) use LC. Undefined for unknown / direct-attach reaches.
 */
export function connectorForReach(reach: string | undefined): string | undefined {
  if (!reach) return undefined;
  const base = reach.trim().toUpperCase().replace(/^\d+X\s*/, '').split(/[\s-]/)[0].replace(/\+$/, '');
  if (/^(DR|SR|VR)8$/.test(base)) return 'MPO-16';
  if (/^(DR4|PSM4|SR4|VR4)$/.test(base)) return 'MPO-12';
  if (/^(DR1?|FR\d*|LR\d*|ER\d*|ZR|SR|LH)$/.test(base)) return 'LC';
  return undefined;
}

/**
 * Connector a cable must have on this port: the port itself (CPO/NPO), the module's fiber connector, the one an
 * optical reach implies, or — no module in the cage — the cage form factor (a DAC / AEC / AOC plugs in there).
 */
export function cableConnector(group: PortGroup, optic?: OpticDefinition, reach?: string): string | undefined {
  if (isEnginePort(group)) return group.formFactor;
  if (!optic) return connectorForReach(reach) ?? group.formFactor;
  return optic.fiberConnector ? optic.fiberConnector.replace(/^\d+x\s*/i, '') : optic.formFactor;
}

/** Cable connectors on the face of one port: count x connector (e.g. 2x DR4 module -> 2 x MPO-12). */
export interface PortConnectors {
  count: number;
  connector: string;
}

/**
 * Physical cable connectors a port exposes: the module's fiber connector(s), or — for CPO/NPO fiber ports —
 * the port itself, which is one connector whatever the reach (an MMC-16 carries 2xDR4 on its 16 fibers;
 * split it with a Y-cable). None for DAC/AOC/laser or an empty cage.
 */
export function portConnectors(group: PortGroup, optic?: OpticDefinition): PortConnectors | undefined {
  const connector = isEnginePort(group) ? group.formFactor : optic?.fiberConnector.replace(/^\d+x\s*/i, '');
  if (!connector) return undefined;
  return { count: cablesPerPort(group, optic), connector };
}

/**
 * Cables needed per port: the multiplier of the module's fiber connector ("2x MPO-12" -> 2).
 * CPO/NPO fiber ports are a single connector: 1.
 */
export function cablesPerPort(group: PortGroup, optic?: OpticDefinition): number {
  if (isEnginePort(group)) return 1;
  const text = optic?.fiberConnector;
  const n = Number(/^(\d+)x/i.exec(text ?? '')?.[1]);
  return n > 0 ? n : 1;
}

/** Fiber type a reach class needs: SR/VR = multimode, every other optical reach = single-mode. */
export function fiberTypeFor(reach: string | undefined): CableMedia['type'] | undefined {
  if (!reach || /DAC|AEC|AOC|ELS/i.test(reach)) return undefined;
  return /SR|VR/i.test(reach) ? 'fiber-mm' : 'fiber-sm';
}

/** Cables whose connector matches the port/module and whose fiber type matches the reach. */
export function compatibleCables(lib: Library, group: PortGroup, optic?: OpticDefinition, reach?: string, mode?: string): CableMedia[] {
  // Empty cage: only direct-attach cables plug in (of the reach's kind when one is set).
  if (!optic && !isEnginePort(group) && !connectorForReach(reach)) return directAttachCables(lib, group, mode ?? `1x${group.speedGbps}G`, reach);
  const connector = cableConnector(group, optic, reach);
  const fiber = fiberTypeFor(optic?.reach ?? reach);
  return lib.cableMedia.items().filter((c) =>
    c.type !== 'power' && !isDirectAttach(c.type)
    && (!connector || connectorsMate(c.ends.a.connector, connector) || connectorsMate(c.ends.b.connector, connector))
    && (!fiber || !c.type.startsWith('fiber') || c.type === fiber));
}
