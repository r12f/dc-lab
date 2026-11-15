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

/** Port group id of a device's PSU power inlets (derived from `psus`, not stored in `ports`). */
export const PSU_GROUP_ID = 'psu';

/**
 * The PSU power inlets as a rear port group ("psu/1".."psu/n", form factor = inlet, e.g. C14 / C20), so power
 * cords connect like any other cable. Busbar-fed devices have no cordable inlet.
 */
export function powerInletGroup(device: DeviceDefinition): PortGroup | undefined {
  const p = device.psus;
  if (!p || p.count <= 0 || !p.inlet || /busbar/i.test(p.inlet)) return undefined;
  return { id: PSU_GROUP_ID, label: 'PSU', role: 'inlet', formFactor: p.inlet, count: p.count, speedGbps: 0, lanes: 0, face: 'rear', rows: 1, breakoutModes: [] };
}

/** Grid cell (column, row) of the i-th port (0-based) of a group: column-major over `rows`, skipping `holes`. */
export function portCell(g: PortGroup, i: number, rows = Math.max(1, g.rows)): { col: number; row: number } {
  const holes = new Set(g.holes ?? []);
  let cell = -1;
  for (let n = 0; n <= i; n++) do cell++; while (holes.has(cell));
  return { col: Math.floor(cell / rows), row: cell % rows };
}

/** Number of grid columns a group spans (holes included). */
export function groupCols(g: PortGroup, rows = Math.max(1, g.rows)): number {
  return g.count ? portCell(g, g.count - 1, rows).col + 1 : 0;
}

export function findGroup(device: DeviceDefinition, groupId: string): PortGroup | undefined {
  return device.ports.find((g) => g.id === groupId) ?? (groupId === PSU_GROUP_ID ? powerInletGroup(device) : undefined);
}

/** Every cable-connectable group on a face: the device's port groups plus its PSU inlets (rear). */
export function cableGroupsOnFace(device: DeviceDefinition, face: PortFace): PortGroup[] {
  const inlets = powerInletGroup(device);
  return [...groupsOnFace(device, face), ...(inlets && inlets.face === face ? [inlets] : [])];
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
