import type { ConnectorGender } from '../optics/types';
import type { HeatSink } from '../ports/form-factors';
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
  /**
   * Empty grid cells: indices (column-major over `rows`) left blank, so ports skip them — e.g. a module with one
   * slot top-left and a 3x3 block beside it. Ports fill the remaining cells in order.
   */
  holes?: number[];
  /** Port fill order over the grid: `column-major` (default: down each column) or `row-major` (along each row). */
  fill?: 'column-major' | 'row-major';
  /** Rows count from the bottom: port 1 sits in the bottom row. */
  bottomUp?: boolean;
  /**
   * Columns count from the right: the group is drawn left-right mirrored, as the rear of a pass-through panel
   * (a fiber housing) is seen from behind.
   */
  rightToLeft?: boolean;
  /**
   * Row of the face the group sits in (0 = top, default): groups of one row run left to right, rows stack top
   * to bottom — e.g. a panel with a top and a bottom row of adapter blocks.
   */
  faceRow?: number;
  /**
   * Two-level port names: every `subPorts` ports share a number and take letters — 4 gives 1A 1B 1C 1D 2A… (a
   * cassette of 4 connectors). Unset / 1 = plain numbers.
   */
  subPorts?: number;
  /** Number the group's names start at (e.g. 7 for the second column of 6 cassettes); default 1. */
  firstNumber?: number;
  /**
   * Printed number of each port in fill order, when the faceplate does not number ports in fill order (e.g. a
   * housing whose lone top-left slot is 10 after a 3x3 block 1-9): [1, 2, 3, 4, 5, 6, 10, 7, 8, 9]. Counted from
   * `firstNumber` like the default numbering; names only — port refs stay `group/index`.
   */
  portNumbers?: number[];
  /**
   * Fiber connector ports: cable connectors in one port (a housing slot holding 2x MMC-16); default 1. Each is a
   * connector leg cables attach to (endpoint `connector` 1..n).
   */
  connectorsPerPort?: number;
  /** How a port's connectors sit: `side-by-side` (default, 1 left) or `stacked` (1 at the bottom, upwards). */
  connectorLayout?: 'side-by-side' | 'stacked';
  /** Pluggable cages: module heat sink the cage takes (IHS or RHS, not interchangeable); unset = RHS. */
  heatSink?: HeatSink;
  /**
   * Fiber connector ports (MPO, MMC, LC…): gender of the cable connector the port takes — `male` = plug a male
   * (pinned) cable end in here. Only cable ends of this gender fit. Required for every fiber port.
   */
  cableGender?: ConnectorGender;
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
  /**
   * Repeatable: one placement can stack n copies (n x `height`), drawn as one block and counted n times in the BOM,
   * power and weight. Off by default (a switch repeated makes no sense: every copy is cabled differently); fillers
   * default to on. Only one copy's ports are cabled.
   */
  repeatable?: boolean;
}
