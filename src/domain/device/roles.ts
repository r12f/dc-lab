import type { PortRole } from './types';

export interface RoleTraits {
  label: string;
  /** Whether ports of this role carry pluggable optics / breakout. */
  pluggable: boolean;
}

export const ROLE_TRAITS: Record<PortRole, RoleTraits> = {
  data: { label: 'Data', pluggable: true },
  service: { label: 'Service', pluggable: true },
  mgmt: { label: 'Mgmt', pluggable: false },
  console: { label: 'Console', pluggable: false },
  laser: { label: 'Laser source', pluggable: false },
  outlet: { label: 'Power outlet', pluggable: false },
  inlet: { label: 'Power inlet', pluggable: false },
};

export const PORT_ROLES = Object.keys(ROLE_TRAITS) as PortRole[];
