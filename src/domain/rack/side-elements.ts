import type { DeviceDefinition, DeviceCategory } from '../device/types';
import { DEVICE_CATEGORIES, traitsOf } from '../device/categories';

export type SideName = 'left' | 'right';

/** Rack faces a side space is open to. */
export type SideFaces = 'both' | 'front' | 'rear';

/**
 * A space attached to the left or right of the rack body. All spaces are the same thing — a box of some width that
 * may hold some devices — told apart only by their fields:
 * - `accepts`: device categories that mount in it (missing = any; empty = none, e.g. a cable manager or side panel);
 * - `faces`: open to the front, the rear or both (a PDU bay / manifold / busbar: rear; a cable manager: front);
 * - `inside`: sits inside the rack enclosure (between rails and side panel) and adds no width to the footprint.
 * The rack's overall width is the body plus every space not `inside`.
 */
export interface SideElement {
  id: string;
  name: string;
  side: SideName;
  widthMm: number;
  depthMm: number;
  /** Vertical mounting positions inside the box. */
  slots: number;
  weightKg: number;
  accepts?: DeviceCategory[];
  faces: SideFaces;
  inside?: boolean;
}

/** Presets for "+ Left / + Right": starting values only — every field stays editable. */
export interface SidePreset {
  label: string;
  values: Omit<SideElement, 'id' | 'name' | 'side' | 'depthMm'>;
}

export const SIDE_PRESETS = {
  sidepod: { label: 'Sidepod', values: { widthMm: 300, slots: 1, weightKg: 40, faces: 'both' } },
  'pdu-bay': { label: 'PDU bay', values: { widthMm: 100, slots: 1, weightKg: 5, faces: 'rear', inside: true, accepts: ['pdu'] } },
  'cable-manager': { label: 'Cable manager', values: { widthMm: 150, slots: 0, weightKg: 15, faces: 'front', accepts: [] } },
  'patch-panel-holder': { label: 'Patch panel holder', values: { widthMm: 150, slots: 1, weightKg: 10, faces: 'front', accepts: ['patch-panel'] } },
  'side-panel': { label: 'Side panel', values: { widthMm: 20, slots: 0, weightKg: 15, faces: 'both', accepts: [] } },
  manifold: { label: 'Manifold', values: { widthMm: 100, slots: 0, weightKg: 20, faces: 'rear', inside: true, accepts: [] } },
  'power-busbar': { label: 'Power busbar', values: { widthMm: 80, slots: 0, weightKg: 15, faces: 'rear', inside: true, accepts: [] } },
} satisfies Record<string, SidePreset>;
export type SidePresetId = keyof typeof SIDE_PRESETS;
export const SIDE_PRESET_IDS = Object.keys(SIDE_PRESETS) as SidePresetId[];

export const FACE_LABELS: Record<SideFaces, string> = { both: 'Front + rear', front: 'Front only', rear: 'Rear only' };

/** Network racks: a PDU bay on each side; `sidepods` adds a sidepod outside each bay ("(w/ Sidepods)" templates). */
export function defaultSideElements(kind: string, depthMm: number, sidepods = false): SideElement[] {
  if (kind !== 'network') return [];
  return (['left', 'right'] as const).flatMap((side) => {
    const s = side === 'left' ? 'l' : 'r';
    const bay = newSideElement(`pdu-bay-${s}`, 'pdu-bay', side, depthMm);
    return sidepods ? [bay, newSideElement(`sidepod-${s}`, 'sidepod', side, depthMm)] : [bay];
  });
}

export function newSideElement(id: string, preset: SidePresetId, side: SideName, depthMm: number): SideElement {
  const p: SidePreset = SIDE_PRESETS[preset];
  return { id, name: `${p.label} ${side === 'left' ? 'L' : 'R'}`, side, depthMm, ...structuredClone(p.values) };
}

/** Elements on one side, ordered from the rack body outward. */
export function elementsOn(elements: readonly SideElement[], side: SideName): SideElement[] {
  return elements.filter((e) => e.side === side);
}

/** True when the device's category may mount in the space. */
export const sideAccepts = (e: Pick<SideElement, 'accepts'>, device: Pick<DeviceDefinition, 'category'>): boolean =>
  !e.accepts || e.accepts.includes(device.category);

/** Categories a space accepts, for display: "any", "none" or the labels. */
export function acceptsLabel(e: Pick<SideElement, 'accepts'>): string {
  if (!e.accepts) return 'any device';
  if (e.accepts.length === 0) return 'nothing';
  return e.accepts.map((c) => traitsOf(c).label).join(', ');
}

/** Default-placement order: the most specific space first (a PDU bay before a sidepod that takes anything). */
export const sidePriority = (e: Pick<SideElement, 'accepts'>): number => e.accepts?.length ?? DEVICE_CATEGORIES.length;

/** True when the space is shown on (and reached from) that rack face. */
export const onFace = (e: Pick<SideElement, 'faces'>, face: 'front' | 'rear'): boolean => e.faces === 'both' || e.faces === face;

/** True when the element sits inside the rack enclosure (PDU bay) and takes no floor space. */
export const isInternal = (e: Pick<SideElement, 'inside'>): boolean => !!e.inside;

/** Footprint width: rack body plus the side elements outside it (internal ones such as PDU bays excluded). */
export function overallWidthMm(bodyWidthMm: number, elements: readonly SideElement[]): number {
  return bodyWidthMm + elements.filter((e) => !isInternal(e)).reduce((n, e) => n + e.widthMm, 0);
}

/** Raised-floor tile edge (mm). */
export const FLOOR_TILE_MM = 600;

/** Tiles for a length: rounded up to whole tiles, or half tiles when `half` (a row's rack pitch). */
const tilesFor = (mm: number, half: boolean) => {
  const t = mm / FLOOR_TILE_MM;
  return Math.max(half ? 0.5 : 1, half ? Math.ceil(t * 2 - 1e-9) / 2 : Math.ceil(t - 1e-9));
};

/**
 * Floor tiles a rack takes — **computed, not set**: wide = overall width (body + side elements outside it) over the
 * 600 mm tile, rounded up to half a tile (two 900 mm racks share 3 tiles); deep = rack depth, rounded up to whole tiles.
 * E.g. 600 mm body + 2 x 300 mm sidepods = 1200 mm = 2 tiles.
 */
export function footprintTiles(rack: { widthMm: number; depthMm: number; sideElements: readonly SideElement[] }): { wide: number; deep: number } {
  return { wide: tilesFor(overallWidthMm(rack.widthMm, rack.sideElements), true), deep: tilesFor(rack.depthMm, false) };
}

/** Old `kind` field -> the equivalent fields (pdu-bay: inside, rear, PDUs; cable-manager: front, nothing; other: zero-U). */
export function migrateSideKind(e: Record<string, unknown>): Record<string, unknown> {
  if (!('kind' in e)) return e.faces ? e : { ...e, faces: 'both' };
  const { kind, ...rest } = e;
  const zeroU = DEVICE_CATEGORIES.filter((c) => traitsOf(c).allowsZeroU);
  const by: Record<string, Partial<SideElement>> = {
    sidepod: { faces: 'both' },
    'pdu-bay': { faces: 'rear', inside: true, accepts: ['pdu'] },
    'cable-manager': { faces: 'front', accepts: [] },
    other: { faces: 'both', accepts: zeroU },
  };
  return { ...rest, ...(by[String(kind)] ?? { faces: 'both' }) };
}
