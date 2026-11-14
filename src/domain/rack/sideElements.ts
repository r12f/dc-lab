import type { DeviceDefinition } from '../device/types';
import { traitsOf } from '../device/categories';

export type SideName = 'left' | 'right';

export type SideElementKind = 'sidepod' | 'pdu-bay' | 'cable-manager' | 'other';

/** A box attached to the left or right of the rack body. */
export interface SideElement {
  id: string;
  name: string;
  kind: SideElementKind;
  side: SideName;
  widthMm: number;
  depthMm: number;
  /** Vertical mounting positions inside the box. */
  slots: number;
  weightKg: number;
}

export interface SideKindTraits {
  label: string;
  dashed: boolean;
  hatched: boolean;
  accepts(device: DeviceDefinition): boolean;
  defaults: Pick<SideElement, 'widthMm' | 'slots' | 'weightKg'>;
  /** Default-placement priority; lower = tried first (dedicated bays before generic sidepods). */
  priority: number;
}

/** Behaviour per side-element kind (registry pattern). */
export const SIDE_KINDS: Record<SideElementKind, SideKindTraits> = {
  sidepod: {
    label: 'Sidepod', dashed: true, hatched: false, accepts: () => true, priority: 3,
    defaults: { widthMm: 300, slots: 2, weightKg: 40 },
  },
  'pdu-bay': {
    label: 'PDU bay', dashed: false, hatched: false, accepts: (d) => d.category === 'pdu', priority: 1,
    defaults: { widthMm: 100, slots: 2, weightKg: 5 },
  },
  'cable-manager': {
    label: 'Cable manager', dashed: false, hatched: true, accepts: () => false, priority: 9,
    defaults: { widthMm: 150, slots: 0, weightKg: 15 },
  },
  other: {
    label: 'Other', dashed: false, hatched: false, accepts: (d) => traitsOf(d.category).allowsZeroU, priority: 2,
    defaults: { widthMm: 200, slots: 1, weightKg: 10 },
  },
};

export const SIDE_ELEMENT_KINDS = Object.keys(SIDE_KINDS) as SideElementKind[];

/**
 * Default side elements by rack kind: network racks get a PDU bay next to the body and a sidepod
 * outside it on each side; server-type racks (server, MGX, ORv3, ORW) get none.
 */
export function defaultSideElements(kind: string, depthMm: number): SideElement[] {
  if (kind !== 'network') return [];
  return (['left', 'right'] as const).flatMap((side) => {
    const s = side === 'left' ? 'l' : 'r';
    return [newSideElement(`pdu-bay-${s}`, 'pdu-bay', side, depthMm), newSideElement(`sidepod-${s}`, 'sidepod', side, depthMm)];
  });
}

export function newSideElement(id: string, kind: SideElementKind, side: SideName, depthMm: number): SideElement {
  const t = SIDE_KINDS[kind];
  return { id, name: `${t.label} ${side === 'left' ? 'L' : 'R'}`, kind, side, depthMm, ...t.defaults };
}

/** Elements on one side, ordered from the rack body outward. */
export function elementsOn(elements: readonly SideElement[], side: SideName): SideElement[] {
  return elements.filter((e) => e.side === side);
}

/** Total width of the rack body plus all side elements. */
export function overallWidthMm(bodyWidthMm: number, elements: readonly SideElement[]): number {
  return bodyWidthMm + elements.reduce((n, e) => n + e.widthMm, 0);
}
