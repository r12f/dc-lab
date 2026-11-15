import type { PortFace, PortSetting } from '../device/types';
export type { SideName } from '../rack/side-elements';

export const DESIGN_SCHEMA = 'dc-lab/rack-design@1';


export type Mount =
  | { kind: 'rack'; position: number; face: PortFace }
  | { kind: 'side'; elementId: string; slot: number };

export interface Placement {
  id: string;
  deviceId: string;
  /** Chosen item (vendor product) of the device item type; empty = the item type's default item. */
  variantId?: string;
  label: string;
  mount: Mount;
  /** Repeatable devices only: copies stacked in this placement (default 1); occupies repeat x the item's height. */
  repeat?: number;
  breakoutProfileId?: string;
  /** portRef -> instance setting (overrides profile). */
  portSettings: Record<string, PortSetting>;
  /** groupId -> instance setting for the whole group. */
  groupSettings: Record<string, PortSetting>;
}

/** One end of a cable: a connector (leg) on a port of a placed device. */
export interface CableEndpoint {
  placementId: string;
  /** Empty = any port. */
  portRef: string;
  /** 1-based leg of the port's connectors (e.g. 2 = second MPO-12 of a 2xDR4 module); undefined = any. */
  connector?: number;
}

export type CableRoute = 'left' | 'right';

export interface CableRun {
  id: string;
  /** A-end connectors (up to the cable's A connector count). */
  from: CableEndpoint[];
  /** B-end connectors (up to the cable's B connector count). */
  to: CableEndpoint[];
  /** Side cable channel the run uses. */
  route: CableRoute;
  mediaId: string;
  /** Manual length; undefined = auto (estimated from geometry). */
  lengthM?: number;
  quantity: number;
}

export interface RackDesign {
  schema?: typeof DESIGN_SCHEMA;
  id: string;
  name: string;
  /** Short code (1-4 letters/digits, upper case) shown on DC Layout rack tiles, e.g. "GPU", "T0", "CDU". */
  abbr: string;
  templateId: string;
  placements: Placement[];
  cables: CableRun[];
  notes?: string;
  /**
   * Connectors that leave the rack (cross-rack ports): no in-rack cable; DC Layout assigns trunk cables to them.
   * Same endpoint shape as cable ends.
   */
  crossRack?: CableEndpoint[];
}
