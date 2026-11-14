import type { DeviceDefinition, PortGroup, PortFace } from './types';

export interface PortRef {
  groupId: string;
  index: number;
}

export function formatPortRef(ref: PortRef): string {
  return `${ref.groupId}/${ref.index}`;
}

export function parsePortRef(text: string): PortRef | undefined {
  const m = /^(.+)\/(\d+)$/.exec(text);
  return m ? { groupId: m[1], index: Number(m[2]) } : undefined;
}

export function findGroup(device: DeviceDefinition, groupId: string): PortGroup | undefined {
  return device.ports.find((g) => g.id === groupId);
}

/** Every port reference of a device, in group order. */
export function allPortRefs(device: DeviceDefinition): string[] {
  return device.ports.flatMap((g) =>
    Array.from({ length: g.count }, (_, i) => formatPortRef({ groupId: g.id, index: i + 1 })),
  );
}

export function groupsOnFace(device: DeviceDefinition, face: PortFace): PortGroup[] {
  return device.ports.filter((g) => g.face === face);
}

export function totalPorts(device: DeviceDefinition): number {
  return device.ports.reduce((n, g) => n + g.count, 0);
}

export function totalBandwidthGbps(device: DeviceDefinition): number {
  return device.ports.reduce((n, g) => n + g.count * g.speedGbps, 0);
}

/** Switching capacity: data ports only (mgmt/console/service/laser excluded), e.g. 64x800G = 51200. */
export function dataBandwidthGbps(device: DeviceDefinition): number {
  return device.ports.filter((g) => g.role === 'data').reduce((n, g) => n + g.count * g.speedGbps, 0);
}

/**
 * Sidebar order of an item type: switches by data bandwidth, highest first (ties by name);
 * other categories by name (undefined).
 */
export function deviceSortKey(device: DeviceDefinition): number | undefined {
  return device.category === 'switch' ? -dataBandwidthGbps(device) : undefined;
}
