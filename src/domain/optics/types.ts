import type { CatalogItem } from '../catalog-item';

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
/** An optic item type; vendor products are ItemVariants of it. */
export interface OpticDefinition extends CatalogItem {
  schema?: typeof OPTIC_SCHEMA;
  packaging: OpticPackaging;
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

export type ConnectorGender = 'male' | 'female';

/** One end of a cable: `count` identical connectors, each using `fibers` fibers. */
export interface CableEnd {
  count: number;
  /** Connector type, e.g. "LC", "MPO-8", "MPO-12", "MMC-16", "OSFP" (DAC). */
  connector: string;
  /** Fibers used per connector (fiber cables). */
  fibers?: number;
  /** MPO/MMC only: male = pinned, female = unpinned. */
  gender?: ConnectorGender;
}

/** How fibers run from A to B: in order, or every A connector split evenly over all B connectors. */
export type FiberMapping = 'straight' | 'shuffle';

/** MPO polarity: A = key-up to key-down straight-through, B = reversed, C = pair-flipped. */
export type Polarity = 'A' | 'B' | 'C';

/** A cable item type; vendor products are ItemVariants of it. */
export interface CableMedia extends CatalogItem {
  schema?: typeof CABLE_SCHEMA;
  type: CableType;
  ends: { a: CableEnd; b: CableEnd };
  /** Fibers in the cable body (e.g. 160 for a 160F trunk). */
  fiberCount?: number;
  mapping: FiberMapping;
  polarity?: Polarity;
  maxLengthM?: number;
  color: string;
}
