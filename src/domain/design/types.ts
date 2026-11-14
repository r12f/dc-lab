import type { PortFace, PortSetting } from '../device/types';

export const DESIGN_SCHEMA = 'dc-lab/rack-design@1';

export type SideName = 'left' | 'right';

export type Mount =
  | { kind: 'rack'; position: number; face: PortFace }
  | { kind: 'side'; side: SideName; slot: number };

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

export interface CableRun {
  id: string;
  from: CableEndpoint;
  to: CableEndpoint;
  mediaId: string;
  lengthM: number;
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
