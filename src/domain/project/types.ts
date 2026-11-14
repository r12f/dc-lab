import type { CatalogSet } from '../library/Library';
import type { RackDesign } from '../design/types';
import type { DcLayout } from '../layout/types';
import type { PropertyDef, PropertyValue } from '../properties/types';

export const PROJECT_SCHEMA = 'dc-lab/project@1';

export interface Project extends CatalogSet {
  schema: typeof PROJECT_SCHEMA;
  name: string;
  rackDesigns: RackDesign[];
  layouts: DcLayout[];
  /** Built-in item ids deleted in this project. */
  hiddenBuiltins: string[];
  /** Project-wide custom property definitions. */
  propertyDefs: PropertyDef[];
  /** Custom property values for built-in (read-only) devices and racks, by item id. */
  builtinProperties: Record<string, Record<string, PropertyValue>>;
}

export function emptyProject(name = 'Untitled project'): Project {
  return {
    schema: PROJECT_SCHEMA, name,
    devices: [], racks: [], optics: [], cableMedia: [], rackDesigns: [], layouts: [], hiddenBuiltins: [], propertyDefs: [], builtinProperties: {},
  };
}
