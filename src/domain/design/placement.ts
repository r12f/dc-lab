import type { DeviceDefinition, PortFace } from '../device/types';
import { traitsOf } from '../device/categories';
import { sizedDevice } from './sizing';
import type { RackTemplate } from '../rack/types';
import { acceptsLabel, sideAccepts, sidePriority } from '../rack/side-elements';
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

/**
 * RU devices go into RU racks, OU devices into OU racks (19" vs 21" mounting); 0U devices (side-mounted
 * PDUs, patch panels) fit either.
 */
export function unitSystemProblem(device: DeviceDefinition, rack: RackTemplate): string | undefined {
  if (device.height.units === 0 || device.height.system === rack.unitSystem || traitsOf(device.category).filler) return undefined;
  return `${device.height.system} device does not fit a ${rack.unitSystem} rack`;
}

/** Devices that can go into `rack` (same unit system, or 0U). */
export function fitsRackUnits(device: DeviceDefinition, rack: RackTemplate): boolean {
  return !unitSystemProblem(device, rack);
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
  /** Copies of a repeatable device; defaults to the placement being moved, else 1. */
  repeat = design.placements.find((p) => p.id === ignoreId)?.repeat,
): string | undefined {
  const rack = lib.racks.get(design.templateId);
  if (!rack) return 'Unknown rack template';
  if (mount.kind === 'side') {
    const el = rack.sideElements.find((e) => e.id === mount.elementId);
    if (!el) return 'Unknown side element';
    if (!sideAccepts(el, device)) return `${el.name} does not accept ${traitsOf(device.category).label} (takes ${acceptsLabel(el)})`;
    if (mount.slot < 1 || mount.slot > el.slots) return `${el.name} has no slot ${mount.slot}`;
    const taken = design.placements.some(
      (p) => p.id !== ignoreId && p.mount.kind === 'side' && p.mount.elementId === mount.elementId && p.mount.slot === mount.slot,
    );
    return taken ? 'Side slot occupied' : undefined;
  }
  device = sizedDevice(lib.devices.get(device.id) ?? device, rack, repeat);
  if (device.height.units === 0) return '0U device mounts in a side element (PDU bay / sidepod), not in the rack body';
  const sys = unitSystemProblem(device, rack);
  if (sys) return sys;
  const span = spanOf(device, rack, mount);
  if (!span) return undefined;
  if (span.bottom < 1 || span.top > rack.units) return `Does not fit (units ${span.bottom}-${span.top} of ${rack.units})`;
  for (const other of design.placements) {
    if (other.id === ignoreId) continue;
    const od = lib.devices.get(other.deviceId);
    const os = od && spanOf(sizedDevice(od, rack, other.repeat), rack, other.mount);
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

/**
 * A copy of a placement: same item, height, profile and port settings; next free label; mounted at the nearest
 * free spot — right above the source, else the closest free unit (side devices: first free side slot).
 * Cables are not copied. Undefined when the rack has no room.
 */
export function duplicatePlacement(lib: Library, design: RackDesign, id: string, newId: string): Placement | undefined {
  const src = design.placements.find((p) => p.id === id);
  const device = src && lib.devices.get(src.deviceId);
  const rack = lib.racks.get(design.templateId);
  if (!src || !device || !rack) return undefined;
  let mount: Mount | undefined;
  if (src.mount.kind === 'rack') {
    const face = src.mount.face;
    const h = sizedDevice(device, rack, src.repeat).height.units;
    const fits = (pos: number) => pos >= 1 && pos <= rack.units
      && !placementProblem(lib, design, device, { kind: 'rack', position: pos, face }, undefined, src.repeat);
    const from = src.mount.position;
    const order = [from + h, ...Array.from({ length: rack.units }, (_, i) => i + 1)
      .sort((a, b) => Math.abs(a - from) - Math.abs(b - from) || b - a)];
    const pos = order.find(fits);
    if (pos !== undefined) mount = { kind: 'rack', position: pos, face };
  } else {
    mount = firstFreeSideSlot(lib, design, device);
  }
  if (!mount) return undefined;
  const label = nextLabel(design, src.label.replace(/\d+$/, '') || traitsOf(device.category).labelPrefix);
  return { ...structuredClone(src), id: newId, label, mount };
}

/** First free side-element slot that accepts the device; the most specific space (e.g. PDU bay) first. */
export function firstFreeSideSlot(lib: Library, design: RackDesign, device: DeviceDefinition): Mount | undefined {
  const rack = lib.racks.get(design.templateId);
  if (!rack) return undefined;
  const ordered = [...rack.sideElements].sort((a, b) => sidePriority(a) - sidePriority(b));
  for (const el of ordered) {
    for (let slot = 1; slot <= el.slots; slot++) {
      const mount: Mount = { kind: 'side', elementId: el.id, slot };
      if (!placementProblem(lib, design, device, mount)) return mount;
    }
  }
  return undefined;
}

/** Default mount: zero-U devices go to a free side slot (never the rack body), everything else to the lowest free unit. */
export function defaultMount(lib: Library, design: RackDesign, device: DeviceDefinition): Mount | undefined {
  if (device.height.units === 0) return firstFreeSideSlot(lib, design, device);
  const pos = firstFreePosition(lib, design, device);
  return pos === undefined ? undefined : { kind: 'rack', position: pos, face: 'front' };
}
