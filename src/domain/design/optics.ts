import type { DeviceDefinition } from '../device/types';
import { allPortRefs, parsePortRef } from '../device/ports';
import type { Placement } from './types';

/** Optic id on a port: per-port override, else group default. */
export function opticOnPort(placement: Placement, portRef: string): string | undefined {
  const explicit = placement.portConfig[portRef]?.opticId;
  if (explicit !== undefined) return explicit || undefined;
  const ref = parsePortRef(portRef);
  return ref ? placement.groupOptics[ref.groupId] : undefined;
}

/** opticId -> count for every port of the placement. */
export function opticCounts(device: DeviceDefinition, placement: Placement): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ref of allPortRefs(device)) {
    const id = opticOnPort(placement, ref);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
