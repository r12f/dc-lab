import type { PortFace, PortSetting } from '../device/types';
export type { SideName } from '../rack/side-elements';

export const DESIGN_SCHEMA = 'dc-lab/rack-design@1';


export type Mount =
  | { kind: 'rack'; position: number; face: PortFace }
  | { kind: 'side'; elementId: string; slot: number };

export interface Placement {
  id: string;
  deviceId: string;
  label: string;
  mount: Mount;
  breakoutProfileId?: string;
  /** portRef -> instance setting (overrides profile). */
  portSettings: Record<string, PortSetting>;
  /** groupId -> instance setting for the whole group. */
  groupSettings: Record<string, PortSetting>;
}

export interface CableEndpoint {
  placementId: string;
  portRef: string;
}

export type CableRoute = 'left' | 'right';

export interface CableRun {
  id: string;
  from: CableEndpoint;
  to: CableEndpoint;
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
  templateId: string;
  placements: Placement[];
  cables: CableRun[];
  notes?: string;
}
