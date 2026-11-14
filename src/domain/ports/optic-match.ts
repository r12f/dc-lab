import type { Library } from '../library/library';
import type { PortGroup } from '../device/types';
import type { CableMedia, OpticDefinition } from '../optics/types';
import { parseMode } from '../device/breakout';
import { formFactorSpec, moduleFits } from './form-factors';
import { connectorsMate } from '../optics/connectors';

/** Total port speed of a breakout mode ("2x400G" -> 800). */
export function modeTotalGbps(mode: string): number {
  const m = parseMode(mode);
  return m ? m.fanout * m.speedGbps : 0;
}

/** True when the group is a CPO/NPO fiber port (no pluggable module). */
export function isEnginePort(group: PortGroup): boolean {
  return !!group.opticalEngine || formFactorSpec(group.formFactor).kind === 'fiber';
}

/** Modules that fit the cage and run at the mode's total speed. */
export function compatibleOptics(lib: Library, group: PortGroup, mode: string): OpticDefinition[] {
  if (isEnginePort(group)) return [];
  // Laser-source cages carry no data rate: any module of the cage form factor fits.
  if (group.role === 'laser') return lib.optics.items().filter((o) => moduleFits(group.formFactor, o.formFactor));
  const total = modeTotalGbps(mode);
  return lib.optics.items().filter((o) => moduleFits(group.formFactor, o.formFactor) && o.speedGbps === total);
}

/** Reach classes available for a port at a mode: engine reaches for CPO/NPO, module reaches otherwise. */
export function reachOptions(lib: Library, group: PortGroup, mode: string): string[] {
  if (isEnginePort(group)) return group.reaches ?? [];
  return [...new Set(compatibleOptics(lib, group, mode).map((o) => o.reach))];
}

/**
 * The module used on a port: a pinned module if it fits cage + speed (+ reach when set),
 * otherwise the first catalog module matching cage + speed + reach.
 */
export function pickOptic(lib: Library, group: PortGroup, mode: string, reach?: string, opticId?: string): OpticDefinition | undefined {
  const options = compatibleOptics(lib, group, mode);
  const pinned = opticId ? options.find((o) => o.id === opticId) : undefined;
  if (pinned) return pinned;
  if (!reach) return undefined;
  return options.find((o) => o.reach === reach);
}

/** Connector a cable must have on this port: the module's fiber connector, or the port itself. */
export function cableConnector(group: PortGroup, optic?: OpticDefinition): string | undefined {
  if (isEnginePort(group)) return group.formFactor;
  if (!optic) return undefined;
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
  if (!reach || /DAC|AOC|ELS/i.test(reach)) return undefined;
  return /SR|VR/i.test(reach) ? 'fiber-mm' : 'fiber-sm';
}

/** Cables whose connector matches the port/module and whose fiber type matches the reach. */
export function compatibleCables(lib: Library, group: PortGroup, optic?: OpticDefinition, reach?: string): CableMedia[] {
  const connector = cableConnector(group, optic);
  const fiber = fiberTypeFor(optic?.reach ?? reach);
  return lib.cableMedia.items().filter((c) =>
    c.type !== 'power'
    && (!connector || connectorsMate(c.ends.a.connector, connector) || connectorsMate(c.ends.b.connector, connector))
    && (!fiber || !c.type.startsWith('fiber') || c.type === fiber));
}
