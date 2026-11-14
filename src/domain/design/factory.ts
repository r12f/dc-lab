import type { RackDesign } from './types';
import { DESIGN_SCHEMA } from './types';
import { abbrFromName, cleanAbbr } from './abbr';

export function newDesign(id: string, name: string, templateId: string, abbr = abbrFromName(name)): RackDesign {
  return { schema: DESIGN_SCHEMA, id, name, abbr: cleanAbbr(abbr) || abbrFromName(name), templateId, placements: [], cables: [] };
}
