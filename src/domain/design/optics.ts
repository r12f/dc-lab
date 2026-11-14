import type { DeviceDefinition } from '../device/types';
import type { Library } from '../library/Library';
import { allPortRefs, parsePortRef } from '../device/ports';
import { findProfile } from '../device/breakout';
import { resolvePort, type ResolvedPort } from '../device/portSettings';
import type { Placement } from './types';
import { cablesPerPort } from '../ports/opticMatch';

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
    if (r?.cableId) cables.set(r.cableId, (cables.get(r.cableId) ?? 0) + cablesPerPort(r.group, r.optic, r.reach));
  }
  return { optics, cables };
}

/** opticId -> count for every port of the placement. */
export function opticCounts(lib: Library, device: DeviceDefinition, placement: Placement): Map<string, number> {
  return portItemCounts(lib, device, placement).optics;
}
