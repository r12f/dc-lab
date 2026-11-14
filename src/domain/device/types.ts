import type { CatalogItem } from '../catalog-item';
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
  | 'tester'
  | 'console-server'
  | 'cdu'
  | 'chiller'
  | 'dc-pdu'
  | 'other'
  | 'blanking-panel'
  | 'stiffener'
  | 'reserved'
  | 'brush-panel';

export type PortFace = 'front' | 'rear';

export type PortRole = 'data' | 'mgmt' | 'console' | 'service' | 'laser' | 'outlet' | 'inlet';

export type OpticalEngine = 'cpo' | 'npo';

export type Phase = 'L1' | 'L2' | 'L3' | 'L1-L2' | 'L2-L3' | 'L3-L1';

/** A run of identical port cages on one face. */
export interface PortGroup {
  id: string;
  label: string;
  role: PortRole;
  /** Physical port type, fixed by hardware: cage (OSFP, QSFP112…), fiber connector (MPO-16, MMC, LC), RJ45, C13. */
  formFactor: string;
  count: number;
  speedGbps: number;
  lanes: number;
  face: PortFace;
  rows: number;
  /** Allowed breakout modes, e.g. "4x200G". Native "1x<speed>G" is implicit. */
  breakoutModes: string[];
  /** Fiber ports driven by co-packaged / near-packaged optics. */
  opticalEngine?: OpticalEngine;
  /** Reach classes a CPO/NPO engine supports, e.g. ["DR4", "2xDR4"]. */
  reaches?: string[];
  /** PDU outlet groups: breaker bank and phase. */
  bank?: string;
  phase?: Phase;
  /** PDU outlet groups: bank breaker rating in amps. */
  breakerA?: number;
}

/** Configuration of one port: speed/breakout, reach, optional pinned module, attached cable. */
export interface PortSetting {
  mode?: string;
  reach?: string;
  opticId?: string;
  cableId?: string;
}

/** A named per-port configuration layout. */
export interface BreakoutProfile {
  id: string;
  name: string;
  /** groupId -> setting for every port of the group. */
  groupDefaults: Record<string, PortSetting>;
  /** portRef ("group/index") -> setting. */
  overrides: Record<string, PortSetting>;
}

export interface DevicePower {
  typicalW: number;
  maxW: number;
  /** Supply capacity for PDUs / power shelves. */
  capacityW?: number;
}

/** Hot-swap PSUs on the rear face, split evenly left/right. */
export interface PsuSpec {
  count: number;
  /** Rear arrangement: `split` = half on each edge (default), `row` = one row side by side (power shelves). */
  layout?: 'split' | 'row';
  inlet: string;
  ratedW: number;
}

/** PDU input feed. */
export interface PduInput {
  phases: 1 | 3;
  voltageV: number;
  inputCurrentA: number;
  inputPlug: string;
}

/** An item type: the technical definition. Vendor products are ItemVariants of it. */
export interface DeviceDefinition extends CatalogItem {
  schema?: typeof DEVICE_SCHEMA;
  category: DeviceCategory;
  height: Height;
  depthMm: number;
  weightKg: number;
  power: DevicePower;
  psus?: PsuSpec;
  pdu?: PduInput;
  ports: PortGroup[];
  breakoutProfiles: BreakoutProfile[];
  /** Profile used when a placement (or the Devices canvas) picks none; every device has one ("default"). */
  defaultProfileId?: string;
  notes?: string;
  /** CDUs / chillers: cooling capacity (kW of heat removed) and pump draw (W, added to the device's power). */
  cooling?: { capacityKw: number; pumpW: number };
  /** Height is chosen per placement (1..n units in the rack's unit system); `height` is the default size. Defaults per category (fillers). */
  resizable?: boolean;
}
