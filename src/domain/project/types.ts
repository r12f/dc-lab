import type { CatalogSet } from '../library/Library';
import type { RackDesign } from '../design/types';
import type { DcLayout } from '../layout/types';

export const PROJECT_SCHEMA = 'dc-lab/project@1';

export interface Project extends CatalogSet {
  schema: typeof PROJECT_SCHEMA;
  name: string;
  rackDesigns: RackDesign[];
  layouts: DcLayout[];
  /** Built-in item ids deleted in this project. */
  hiddenBuiltins: string[];
}

export function emptyProject(name = 'Untitled project'): Project {
  return {
    schema: PROJECT_SCHEMA, name,
    devices: [], racks: [], optics: [], cableMedia: [], rackDesigns: [], layouts: [], hiddenBuiltins: [],
  };
}
