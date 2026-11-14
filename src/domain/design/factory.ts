import type { RackDesign } from './types';
import { DESIGN_SCHEMA } from './types';

export function newDesign(id: string, name: string, templateId: string): RackDesign {
  return { schema: DESIGN_SCHEMA, id, name, templateId, placements: [], cables: [] };
}
