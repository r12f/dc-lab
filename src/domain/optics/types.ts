import type { CatalogItem } from '../catalogItem';

export const OPTIC_SCHEMA = 'dc-lab/optic@1';
export const CABLE_SCHEMA = 'dc-lab/cable@1';

/** A pluggable module: transceiver, AOC/DAC end, or external laser source. */
export interface OpticDefinition extends CatalogItem {
  schema?: typeof OPTIC_SCHEMA;
  vendor: string;
  /** Module form factor, e.g. "OSFP", "QSFP28". */
  formFactor: string;
  /** Total module speed (Gbps). */
  speedGbps: number;
  /** Optical interface / reach class, e.g. "2xDR4", "FR4", "SR4", "DAC". */
  reach: string;
  /** Fiber connector on the module, e.g. "MPO-12", "2x MPO-12", "LC"; empty for DAC. */
  fiberConnector: string;
  reachM: number;
  powerW: number;
  weightKg?: number;
}

export type CableType = 'fiber-sm' | 'fiber-mm' | 'copper-dac' | 'aoc' | 'power' | 'other';

export interface CableMedia extends CatalogItem {
  schema?: typeof CABLE_SCHEMA;
  type: CableType;
  /** Connector at the cable ends, e.g. "MPO-12", "LC", "MMC", "OSFP" (DAC). */
  connector: string;
  color: string;
}
