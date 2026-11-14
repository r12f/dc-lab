import type { DeviceDefinition, PortGroup, PortRole } from './types';
import { DEVICE_SCHEMA } from './types';

/** A starting point offered by "+ New" in the Devices module. */
export interface DeviceTemplate {
  id: string;
  label: string;
  description: string;
  build(id: string): DeviceDefinition;
}

function group(id: string, label: string, role: PortRole, formFactor: string, count: number, speedGbps: number,
  extra: Partial<PortGroup> = {}): PortGroup {
  return { id, label, role, formFactor, count, speedGbps, lanes: 1, face: 'front', rows: 1, breakoutModes: [], ...extra };
}

const mgmtAndConsole = (face: PortGroup['face'] = 'front'): PortGroup[] => [
  group('mgmt', 'MGMT', 'mgmt', 'RJ45', 1, 1, { face }),
  group('console', 'CONSOLE', 'console', 'RJ45', 1, 0, { face }),
];

function base(id: string, patch: Partial<DeviceDefinition>): DeviceDefinition {
  return {
    schema: DEVICE_SCHEMA, id, name: 'New device', vendor: 'Generic', model: '', category: 'other',
    height: { units: 1, system: 'RU' }, depthMm: 600, weightKg: 10, power: { typicalW: 300, maxW: 500 },
    ports: [], breakoutProfiles: [], ...patch,
  };
}

const PHASES = ['L1', 'L2', 'L3'] as const;

export const DEVICE_TEMPLATES: DeviceTemplate[] = [
  {
    id: 'switch', label: 'Switch', description: 'Data ports + MGMT + CONSOLE + service, 2 PSUs',
    build: (id) => base(id, {
      name: 'New switch', category: 'switch', psus: { count: 2, inlet: 'C14', ratedW: 1100 },
      ports: [
        group('data', 'OSFP', 'data', 'OSFP', 32, 800, { lanes: 8, rows: 2, breakoutModes: ['2x400G', '4x200G', '8x100G'] }),
        group('service', 'SERVICE', 'service', 'SFP+', 2, 10, { rows: 2 }),
        ...mgmtAndConsole(),
      ],
    }),
  },
  {
    id: 'switch-cpo', label: 'CPO switch', description: 'MPO-16 fiber ports on co-packaged optics + ELSFP laser cages',
    build: (id) => base(id, {
      name: 'New CPO switch', category: 'switch', height: { units: 4, system: 'RU' }, psus: { count: 4, inlet: 'C20', ratedW: 3000 },
      power: { typicalW: 2600, maxW: 3200 },
      ports: [
        group('data', 'MPO-16', 'data', 'MPO-16', 128, 800, { lanes: 8, rows: 4, breakoutModes: ['2x400G', '8x100G'], opticalEngine: 'cpo', reaches: ['DR8', '2xDR4'] }),
        group('els', 'ELSFP', 'laser', 'ELSFP', 16, 0, { rows: 2 }),
        ...mgmtAndConsole(),
      ],
    }),
  },
  {
    id: 'switch-npo', label: 'NPO switch', description: 'MMC fiber ports on near-packaged optics',
    build: (id) => base(id, {
      name: 'New NPO switch', category: 'switch', height: { units: 2, system: 'RU' }, psus: { count: 2, inlet: 'C20', ratedW: 3000 },
      ports: [
        group('data', 'MMC', 'data', 'MMC', 64, 800, { lanes: 8, rows: 2, breakoutModes: ['2x400G', '8x100G'], opticalEngine: 'npo', reaches: ['DR8', '2xFR4'] }),
        ...mgmtAndConsole(),
      ],
    }),
  },
  {
    id: 'server', label: 'Server', description: 'Front NICs + BMC, 2 PSUs',
    build: (id) => base(id, {
      name: 'New server', category: 'server', depthMm: 800, power: { typicalW: 500, maxW: 800 },
      psus: { count: 2, inlet: 'C14', ratedW: 800 },
      ports: [group('nic', 'NIC', 'data', 'QSFP28', 2, 100, { lanes: 4, breakoutModes: ['4x25G'] }), group('bmc', 'BMC', 'mgmt', 'RJ45', 1, 1)],
    }),
  },
  {
    id: 'pdu-vertical', label: 'Vertical PDU (0U)', description: '3-phase, 6 banks of C13/C19, MGMT',
    build: (id) => base(id, {
      name: 'New vertical PDU', category: 'pdu', height: { units: 0, system: 'RU' }, depthMm: 60,
      power: { typicalW: 20, maxW: 30, capacityW: 17300 },
      pdu: { phases: 3, voltageV: 415, inputCurrentA: 32, inputPlug: 'IEC 60309 32A 3P+N+E' },
      ports: [
        ...Array.from({ length: 6 }, (_, i) => {
          const bank = String.fromCharCode(65 + i);
          return group(`bank-${bank.toLowerCase()}`, `Bank ${bank}`, 'outlet', 'C13', 6, 0, { bank, phase: PHASES[i % 3], breakerA: 20 });
        }),
        ...mgmtAndConsole(),
      ],
    }),
  },
  {
    id: 'pdu-horizontal', label: 'Horizontal PDU (1U)', description: 'Single-phase C13 bank',
    build: (id) => base(id, {
      name: 'New horizontal PDU', category: 'pdu', depthMm: 300, power: { typicalW: 10, maxW: 15, capacityW: 7400 },
      pdu: { phases: 1, voltageV: 230, inputCurrentA: 32, inputPlug: 'IEC 60309 32A 2P+E' },
      ports: [group('c13', 'C13', 'outlet', 'C13', 16, 0, { face: 'rear', bank: 'A', phase: 'L1', breakerA: 16 })],
    }),
  },
  {
    id: 'patch-panel', label: 'Patch panel', description: '12 MPO adapters',
    build: (id) => base(id, {
      name: 'New patch panel', category: 'patch-panel', depthMm: 300, weightKg: 3, power: { typicalW: 0, maxW: 0 },
      ports: [group('mpo', 'MPO', 'data', 'MPO-12', 12, 0, { lanes: 12 })],
    }),
  },
  {
    id: 'ocs', label: 'Optical circuit switch', description: 'LC duplex ports, MGMT, 2 PSUs',
    build: (id) => base(id, {
      name: 'New OCS', category: 'ocs', height: { units: 4, system: 'RU' }, psus: { count: 2, inlet: 'C14', ratedW: 400 },
      ports: [group('lc', 'LC', 'data', 'LC', 128, 0, { lanes: 2, rows: 4 }), ...mgmtAndConsole()],
    }),
  },
  {
    id: 'power-shelf', label: 'Power shelf', description: 'OU power shelf with 6 PSUs',
    build: (id) => base(id, {
      name: 'New power shelf', category: 'power-shelf', height: { units: 1, system: 'OU' }, depthMm: 800,
      power: { typicalW: 200, maxW: 300, capacityW: 33000 }, psus: { count: 6, inlet: 'Busbar', ratedW: 5500 },
    }),
  },
  {
    id: 'storage', label: 'Storage', description: 'Storage enclosure, 2 PSUs',
    build: (id) => base(id, {
      name: 'New storage', category: 'storage', height: { units: 2, system: 'RU' }, psus: { count: 2, inlet: 'C14', ratedW: 1200 },
      ports: [group('nic', 'NIC', 'data', 'QSFP28', 2, 100, { lanes: 4 }), group('bmc', 'BMC', 'mgmt', 'RJ45', 1, 1)],
    }),
  },
  { id: 'blank', label: 'Blank', description: 'No ports', build: (id) => base(id, {}) },
];
