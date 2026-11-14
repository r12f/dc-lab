import type { CatalogItem } from '../catalogItem';
import type { Height } from '../units';

export const DEVICE_SCHEMA = 'dc-lab/device@1';

export type DeviceCategory =
  | 'switch'
  | 'server'
  | 'pdu'
  | 'patch-panel'
  | 'ocs'
  | 'power-shelf'
  | 'storage'
  | 'other';

export type PortFace = 'front' | 'rear';

/** A run of identical port cages on one face. */
export interface PortGroup {
  id: string;
  label: string;
  connector: string;
  count: number;
  speedGbps: number;
  lanes: number;
  face: PortFace;
  rows: number;
  /** Allowed breakout modes, e.g. "4x200G". Native "1x<speed>G" is implicit. */
  breakoutModes: string[];
}

/** A named per-port breakout layout. */
export interface BreakoutProfile {
  id: string;
  name: string;
  /** groupId -> default mode for every port of the group. */
  groupDefaults: Record<string, string>;
  /** portRef ("group/index") -> mode. */
  overrides: Record<string, string>;
}

export interface DevicePower {
  typicalW: number;
  maxW: number;
  /** Supply capacity for PDUs / power shelves. */
  capacityW?: number;
}

export interface DeviceDefinition extends CatalogItem {
  schema?: typeof DEVICE_SCHEMA;
  vendor: string;
  model: string;
  category: DeviceCategory;
  height: Height;
  depthMm: number;
  weightKg: number;
  power: DevicePower;
  ports: PortGroup[];
  breakoutProfiles: BreakoutProfile[];
  notes?: string;
}
