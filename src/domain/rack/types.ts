import type { CatalogItem } from '../catalog-item';
import type { UnitSystem } from '../units';
import type { SideElement } from './side-elements';

export const RACK_SCHEMA = 'dc-lab/rack@1';

export type RackKind = 'network' | 'server' | 'mgx' | 'orv3' | 'orw' | 'power' | 'cdu' | 'chiller' | 'custom';

export const RACK_KINDS: Record<RackKind, string> = {
  network: 'Network rack',
  server: 'Server rack',
  mgx: 'MGX rack',
  orv3: 'ORv3 rack',
  orw: 'ORW rack',
  power: 'Power rack',
  cdu: 'CDU rack',
  chiller: 'In-row chiller',
  custom: 'Custom',
};

import type { HasProperties } from '../properties/types';

/** What a rack does in the DC: IT (draws power, makes heat) or infrastructure serving neighbouring IT racks. */
export type RackRole = 'it' | 'power' | 'cdu' | 'chiller';

export function rackRole(kind: RackKind): RackRole {
  return kind === 'power' || kind === 'cdu' || kind === 'chiller' ? kind : 'it';
}

export interface RackTemplate extends CatalogItem, HasProperties {
  schema?: typeof RACK_SCHEMA;
  kind: RackKind;
  units: number;
  unitSystem: UnitSystem;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  footprintTiles: { wide: number; deep: number };
  emptyWeightKg: number;
  maxLoadKg: number;
  maxPowerW: number;
  /** Boxes attached to the left/right of the rack body, ordered from the body outward. */
  sideElements: SideElement[];
  notes?: string;
}

export function newRack(id: string): RackTemplate {
  return {
    schema: RACK_SCHEMA,
    id,
    name: 'New rack',
    kind: 'custom',
    units: 42,
    unitSystem: 'RU',
    widthMm: 600,
    depthMm: 1200,
    heightMm: 2000,
    footprintTiles: { wide: 1, deep: 2 },
    emptyWeightKg: 150,
    maxLoadKg: 1000,
    maxPowerW: 15000,
    sideElements: [],
  };
}
