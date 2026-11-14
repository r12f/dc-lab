import type { CatalogItem } from '../catalogItem';

export const OPTIC_SCHEMA = 'dc-lab/optic@1';
export const CABLE_SCHEMA = 'dc-lab/cable@1';

/** A pluggable transceiver or direct-attach end. */
export interface OpticDefinition extends CatalogItem {
  schema?: typeof OPTIC_SCHEMA;
  vendor: string;
  connector: string;
  speedGbps: number;
  /** Description of the optical interface, e.g. "2xDR4". */
  media: string;
  reachM: number;
  powerW: number;
  weightKg?: number;
}

export type CableType = 'fiber-sm' | 'fiber-mm' | 'copper-dac' | 'aoc' | 'power' | 'other';

export interface CableMedia extends CatalogItem {
  schema?: typeof CABLE_SCHEMA;
  type: CableType;
  connector: string;
  color: string;
}
