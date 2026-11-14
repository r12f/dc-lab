import type { DeviceDefinition, PortFace } from '../device/types';
import { traitsOf } from '../device/categories';
import type { RackTemplate } from '../rack/types';
import { SIDE_KINDS } from '../rack/side-elements';
import { unitsIn } from '../units';
import type { Library } from '../library/library';
import type { Mount, Placement, RackDesign } from './types';

export interface UnitSpan {
  bottom: number;
  top: number;
  faces: PortFace[];
}

export function isFullDepth(device: DeviceDefinition, rack: RackTemplate): boolean {
  return device.depthMm > rack.depthMm / 2;
}

/** Units and faces a rack-mounted device blocks; undefined for side mounts. */
export function spanOf(device: DeviceDefinition, rack: RackTemplate, mount: Mount): UnitSpan | undefined {
  if (mount.kind !== 'rack') return undefined;
  const units = Math.max(1, unitsIn(device.height, rack.unitSystem));
  const faces: PortFace[] = isFullDepth(device, rack) ? ['front', 'rear'] : [mount.face];
  return { bottom: mount.position, top: mount.position + units - 1, faces };
}

function spansOverlap(a: UnitSpan, b: UnitSpan): boolean {
  return a.bottom <= b.top && b.bottom <= a.top && a.faces.some((f) => b.faces.includes(f));
}

/** Why `device` cannot go at `mount` in `design` (ignoring `ignoreId`), or undefined if it fits. */
export function placementProblem(
  lib: Library,
  design: RackDesign,
  device: DeviceDefinition,
  mount: Mount,
  ignoreId?: string,
): string | undefined {
  const rack = lib.racks.get(design.templateId);
  if (!rack) return 'Unknown rack template';
  if (mount.kind === 'side') {
    const el = rack.sideElements.find((e) => e.id === mount.elementId);
    if (!el) return 'Unknown side element';
    if (!SIDE_KINDS[el.kind].accepts(device)) return `${el.name} does not accept ${traitsOf(device.category).label}`;
    if (mount.slot < 1 || mount.slot > el.slots) return `${el.name} has no slot ${mount.slot}`;
    const taken = design.placements.some(
      (p) => p.id !== ignoreId && p.mount.kind === 'side' && p.mount.elementId === mount.elementId && p.mount.slot === mount.slot,
    );
    return taken ? 'Side slot occupied' : undefined;
  }
  const span = spanOf(device, rack, mount);
  if (!span) return undefined;
  if (span.bottom < 1 || span.top > rack.units) return `Does not fit (units ${span.bottom}-${span.top} of ${rack.units})`;
  for (const other of design.placements) {
    if (other.id === ignoreId) continue;
    const od = lib.devices.get(other.deviceId);
    const os = od && spanOf(od, rack, other.mount);
    if (os && spansOverlap(span, os)) return `Overlaps ${other.label}`;
  }
  return undefined;
}

/** Lowest free rack position for a device, if any. */
export function firstFreePosition(
  lib: Library,
  design: RackDesign,
  device: DeviceDefinition,
  face: PortFace = 'front',
): number | undefined {
  const rack = lib.racks.get(design.templateId);
  if (!rack) return undefined;
  for (let pos = 1; pos <= rack.units; pos++) {
    if (!placementProblem(lib, design, device, { kind: 'rack', position: pos, face })) return pos;
  }
  return undefined;
}

export function nextLabel(design: RackDesign, prefix: string): string {
  const used = new Set(design.placements.map((p) => p.label));
  let i = 1;
  while (used.has(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
}

export function newPlacement(id: string, deviceId: string, label: string, mount: Mount): Placement {
  return { id, deviceId, label, mount, portSettings: {}, groupSettings: {} };
}

/** First free side-element slot that accepts the device; dedicated kinds (e.g. PDU bay) first. */
export function firstFreeSideSlot(lib: Library, design: RackDesign, device: DeviceDefinition): Mount | undefined {
  const rack = lib.racks.get(design.templateId);
  if (!rack) return undefined;
  const ordered = [...rack.sideElements].sort((a, b) => SIDE_KINDS[a.kind].priority - SIDE_KINDS[b.kind].priority);
  for (const el of ordered) {
    for (let slot = 1; slot <= el.slots; slot++) {
      const mount: Mount = { kind: 'side', elementId: el.id, slot };
      if (!placementProblem(lib, design, device, mount)) return mount;
    }
  }
  return undefined;
}

/** Default mount: zero-U devices go to a side pod, everything else to the lowest free unit. */
export function defaultMount(lib: Library, design: RackDesign, device: DeviceDefinition): Mount | undefined {
  if (device.height.units === 0) {
    const side = firstFreeSideSlot(lib, design, device);
    if (side) return side;
  }
  const pos = firstFreePosition(lib, design, device);
  return pos === undefined ? undefined : { kind: 'rack', position: pos, face: 'front' };
}
