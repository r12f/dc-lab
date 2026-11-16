import { cablePowerWPerEnd } from '../items/variants';
import { bomItem } from './bom-items';
import type { DeviceDefinition } from '../device/types';
import type { Library } from '../library/library';
import { allPortRefs, parsePortRef } from '../device/ports';
import { findProfile } from '../device/breakout';
import { resolvePort, type ResolvedPort } from '../device/port-settings';
import type { Placement, RackDesign } from './types';
import { cablesPerPort } from '../ports/optic-match';

/** Effective setting of one port of a placed device (instance > profile). */
export function resolvePlacedPort(lib: Library, device: DeviceDefinition, placement: Placement, portRef: string): ResolvedPort | undefined {
  const ref = parsePortRef(portRef);
  return resolvePort(lib, device, portRef, findProfile(device, placement.breakoutProfileId), {
    port: placement.portSettings[portRef],
    group: ref ? placement.groupSettings[ref.groupId] : undefined,
  });
}

export interface PortItemCounts {
  optics: Map<string, number>;
  cables: Map<string, number>;
}

/** Optic module and port-attached cable counts over every port of the placement. */
export function portItemCounts(lib: Library, device: DeviceDefinition, placement: Placement): PortItemCounts {
  const optics = new Map<string, number>();
  const cables = new Map<string, number>();
  for (const ref of allPortRefs(device)) {
    const r = resolvePlacedPort(lib, device, placement, ref);
    if (r?.optic) optics.set(r.optic.id, (optics.get(r.optic.id) ?? 0) + 1);
    if (r?.cableId) cables.set(r.cableId, (cables.get(r.cableId) ?? 0) + cablesPerPort(r.group, r.optic));
  }
  return { optics, cables };
}

/** Power drawn by active direct-attach cable ends (AEC retimers, AOC optics) plugged into the placement's ports. */
export function activeCableW(lib: Library, design: RackDesign, device: DeviceDefinition, placement: Placement): number {
  let w = 0;
  for (const [cableId, n] of portItemCounts(lib, device, placement).cables) w += cablePowerWPerEnd(bomItem(lib, design, cableId), lib.cableMedia.get(cableId)) * n;
  return w;
}

/** opticId -> count for every port of the placement. */
export function opticCounts(lib: Library, device: DeviceDefinition, placement: Placement): Map<string, number> {
  return portItemCounts(lib, device, placement).optics;
}
