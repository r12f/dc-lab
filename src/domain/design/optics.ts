import type { DeviceDefinition } from '../device/types';
import { allPortRefs, parsePortRef } from '../device/ports';
import { findProfile } from '../device/breakout';
import { resolvePort, type ResolvedPort } from '../device/portSettings';
import type { Placement } from './types';

/** Effective setting of one port of a placed device (instance > profile). */
export function resolvePlacedPort(device: DeviceDefinition, placement: Placement, portRef: string): ResolvedPort | undefined {
  const ref = parsePortRef(portRef);
  return resolvePort(device, portRef, findProfile(device, placement.breakoutProfileId), {
    port: placement.portSettings[portRef],
    group: ref ? placement.groupSettings[ref.groupId] : undefined,
  });
}

export interface PortItemCounts {
  optics: Map<string, number>;
  cables: Map<string, number>;
}

/** Optic and port-attached cable counts over every port of the placement. */
export function portItemCounts(device: DeviceDefinition, placement: Placement): PortItemCounts {
  const optics = new Map<string, number>();
  const cables = new Map<string, number>();
  for (const ref of allPortRefs(device)) {
    const r = resolvePlacedPort(device, placement, ref);
    if (r?.opticId) optics.set(r.opticId, (optics.get(r.opticId) ?? 0) + 1);
    if (r?.cableId) cables.set(r.cableId, (cables.get(r.cableId) ?? 0) + 1);
  }
  return { optics, cables };
}

/** opticId -> count for every port of the placement. */
export function opticCounts(device: DeviceDefinition, placement: Placement): Map<string, number> {
  return portItemCounts(device, placement).optics;
}
