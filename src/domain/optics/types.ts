import type { CatalogItem } from '../catalogItem';
import type { HasProperties } from '../properties/types';

export const OPTIC_SCHEMA = 'dc-lab/optic@1';
export const CABLE_SCHEMA = 'dc-lab/cable@1';

export type OpticPackaging = 'module' | 'pigtail';

/** Fiber permanently attached to a pigtail optic. */
export interface Pigtail {
  /** Number of fiber legs. */
  count: number;
  /** Connector at the end of each leg, e.g. "MPO-12", "LC". */
  connector: string;
  fiberType: 'fiber-sm' | 'fiber-mm';
  lengthM: number;
}

/** An optic: pluggable module (transceiver, AOC/DAC end, laser source) or pigtail optic. */
export interface OpticDefinition extends CatalogItem, HasProperties {
  schema?: typeof OPTIC_SCHEMA;
  packaging: OpticPackaging;
  vendor: string;
  /** Model / vendor PN. */
  model?: string;
  /** Module form factor, e.g. "OSFP", "QSFP28". */
  formFactor: string;
  /** Total module speed (Gbps). */
  speedGbps: number;
  /** Optical interface / reach class, e.g. "2xDR4", "FR4", "SR4", "DAC". */
  reach: string;
  /** Connector a cable mates with: module face or pigtail end, e.g. "MPO-12", "2x MPO-12", "LC"; empty for DAC. */
  fiberConnector: string;
  /** Pigtail optics only. */
  pigtail?: Pigtail;
  reachM: number;
  powerW: number;
  weightKg?: number;
}

export type CableType = 'fiber-sm' | 'fiber-mm' | 'copper-dac' | 'aoc' | 'power' | 'other';

export interface CableMedia extends CatalogItem, HasProperties {
  schema?: typeof CABLE_SCHEMA;
  type: CableType;
  vendor?: string;
  /** Model / vendor PN. */
  model?: string;
  /** Fibers per cable (fiber types). */
  fiberCount?: number;
  maxLengthM?: number;
  /** Connector at the cable ends, e.g. "MPO-12", "LC", "MMC", "OSFP" (DAC). */
  connector: string;
  color: string;
}
