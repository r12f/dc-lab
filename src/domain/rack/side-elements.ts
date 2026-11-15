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
  /** Sits inside the rack enclosure (between rails and side panel): adds no width to the footprint. */
  internal?: boolean;
}

/** Behaviour per side-element kind (registry pattern). */
export const SIDE_KINDS: Record<SideElementKind, SideKindTraits> = {
  sidepod: {
    label: 'Sidepod', dashed: true, hatched: false, accepts: () => true, priority: 3,
    defaults: { widthMm: 300, slots: 1, weightKg: 40 },
  },
  'pdu-bay': {
    label: 'PDU bay', dashed: false, hatched: false, accepts: (d) => d.category === 'pdu', priority: 1, internal: true,
    defaults: { widthMm: 100, slots: 1, weightKg: 5 },
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
/** Network racks: a PDU bay on each side; `sidepods` adds a sidepod outside each bay ("(w/ Sidepods)" templates). */
export function defaultSideElements(kind: string, depthMm: number, sidepods = false): SideElement[] {
  if (kind !== 'network') return [];
  return (['left', 'right'] as const).flatMap((side) => {
    const s = side === 'left' ? 'l' : 'r';
    const bay = newSideElement(`pdu-bay-${s}`, 'pdu-bay', side, depthMm);
    return sidepods ? [bay, newSideElement(`sidepod-${s}`, 'sidepod', side, depthMm)] : [bay];
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

/** True when the element sits inside the rack enclosure (PDU bay) and takes no floor space. */
/** Side element kinds reached from the rack rear only (PDU bays): drawn on the rear panel, their devices on the rear. */
export const REAR_ONLY_KINDS: ReadonlySet<SideElementKind> = new Set(['pdu-bay']);

export const isInternal = (e: Pick<SideElement, 'kind'>): boolean => !!SIDE_KINDS[e.kind]?.internal;

/** Footprint width: rack body plus the side elements outside it (internal ones such as PDU bays excluded). */
export function overallWidthMm(bodyWidthMm: number, elements: readonly SideElement[]): number {
  return bodyWidthMm + elements.filter((e) => !isInternal(e)).reduce((n, e) => n + e.widthMm, 0);
}
