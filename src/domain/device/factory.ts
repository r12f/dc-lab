import type { BreakoutProfile, DeviceDefinition, PortGroup } from './types';
import { DEVICE_SCHEMA } from './types';

export function newDevice(id: string): DeviceDefinition {
  return {
    schema: DEVICE_SCHEMA,
    id,
    name: 'New device',
    category: 'switch',
    height: { units: 1, system: 'RU' },
    depthMm: 600,
    weightKg: 10,
    power: { typicalW: 300, maxW: 500 },
    ports: [],
    breakoutProfiles: [],
  };
}

export function newPortGroup(id: string): PortGroup {
  return {
    id,
    label: id.toUpperCase(),
    role: 'data',
    formFactor: 'QSFP28',
    count: 32,
    speedGbps: 100,
    lanes: 4,
    face: 'front',
    rows: 2,
    breakoutModes: ['4x25G'],
  };
}

export function newProfile(id: string, name: string): BreakoutProfile {
  return { id, name, groupDefaults: {}, overrides: {} };
}
