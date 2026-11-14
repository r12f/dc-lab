import type { CatalogSet } from '../library/library';
import type { RackDesign } from '../design/types';
import type { DcLayout } from '../layout/types';
import type { PropertyDef, PropertyValue } from '../properties/types';
import type { ItemVariant } from '../items/types';
import type { BreakoutProfile } from '../device/types';

export const PROJECT_SCHEMA = 'dc-lab/project@1';

export interface Project extends CatalogSet {
  variants: ItemVariant[];
  schema: typeof PROJECT_SCHEMA;
  name: string;
  rackDesigns: RackDesign[];
  layouts: DcLayout[];
  /** Built-in item ids deleted in this project. */
  hiddenBuiltins: string[];
  /** Project-wide custom property definitions. */
  propertyDefs: PropertyDef[];
  /** Custom property values for built-in (read-only) racks and generic items, by id. */
  builtinProperties: Record<string, Record<string, PropertyValue>>;
  /** Breakout profiles of built-in devices edited in this project (replace the built-in list), by device id. */
  builtinProfiles: Record<string, BuiltinProfiles>;
}

export interface BuiltinProfiles {
  breakoutProfiles: BreakoutProfile[];
  defaultProfileId?: string;
}

export function emptyProject(name = 'Untitled project'): Project {
  return {
    schema: PROJECT_SCHEMA, name,
    devices: [], racks: [], optics: [], cableMedia: [], variants: [], rackDesigns: [], layouts: [], hiddenBuiltins: [], propertyDefs: [], builtinProperties: {}, builtinProfiles: {},
  };
}
