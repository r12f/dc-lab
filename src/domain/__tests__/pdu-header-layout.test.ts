import { describe, expect, it } from 'vitest';
import { layoutPdu } from '../../features/devices/drawing/pdu-layout';
import type { DeviceDefinition, PortGroup } from '../device/types';

const g = (id: string, role: PortGroup['role'], count: number): PortGroup =>
  ({ id, label: id, role, formFactor: role === 'outlet' ? 'C13/C19' : 'RJ45', count, speedGbps: 0, lanes: 1, face: 'front', rows: 1, breakoutModes: [] });

describe('PDU header ports', () => {
  it('wrap two per row inside the strip; outlets start below them', () => {
    const d = { id: 'p', name: 'P', category: 'pdu', ports: [g('net', 'mgmt', 2), g('serial', 'console', 1), g('sensor', 'service', 1), g('c1', 'outlet', 4)] } as unknown as DeviceDefinition;
    const l = layoutPdu(d);
    expect(l.headerPorts.map((p) => [p.x, p.y])).toEqual([[l.headerPorts[0].x, 66], [l.headerPorts[1].x, 66], [l.headerPorts[0].x, 100], [l.headerPorts[1].x, 100]]);
    expect(l.headerPorts.every((p) => p.x >= 0 && p.x + p.w <= l.width)).toBe(true);
    expect(Math.min(...l.ports.map((p) => p.y))).toBeGreaterThan(Math.max(...l.headerPorts.map((p) => p.y + p.h)));
  });
});
