import { DEVICE_SCHEMA } from '../device/types';
import { RACK_SCHEMA } from '../rack/types';
import { CABLE_SCHEMA, OPTIC_SCHEMA } from '../optics/types';
import { DESIGN_SCHEMA } from '../design/types';
import { LAYOUT_SCHEMA } from '../layout/types';
import { ITEM_SCHEMA } from '../items/types';
import { migrateProjectJson } from './migrate';
import { emptyProject, PROJECT_SCHEMA, type Project } from './types';

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

type ListKey = 'devices' | 'racks' | 'optics' | 'cableMedia' | 'variants' | 'rackDesigns' | 'layouts';
const LIST_KEYS: ListKey[] = ['devices', 'racks', 'optics', 'cableMedia', 'variants', 'rackDesigns', 'layouts'];

/** Single-item file schema -> project list it belongs to. */
const ITEM_SCHEMAS: Record<string, ListKey> = {
  [DEVICE_SCHEMA]: 'devices',
  [RACK_SCHEMA]: 'racks',
  [OPTIC_SCHEMA]: 'optics',
  [CABLE_SCHEMA]: 'cableMedia',
  [ITEM_SCHEMA]: 'variants',
  [DESIGN_SCHEMA]: 'rackDesigns',
  [LAYOUT_SCHEMA]: 'layouts',
};

/**
 * Parses a project file or a single item file into a Project.
 * Single items are wrapped into an otherwise empty project.
 */
export function parseProjectFile(text: string): Project {
  const data: unknown = JSON.parse(text);
  if (!data || typeof data !== 'object') throw new Error('Not a JSON object');
  const obj = data as Record<string, unknown>;
  if (obj.schema === PROJECT_SCHEMA) return normalizeProject(obj);
  const key = typeof obj.schema === 'string' ? ITEM_SCHEMAS[obj.schema] : undefined;
  if (!key) throw new Error(`Unrecognised file schema "${String(obj.schema)}"`);
  return normalizeProject({ [key]: [obj] });
}

/** Builds a current-version Project from any (possibly older) project-shaped JSON. */
export function normalizeProject(raw: Record<string, unknown>): Project {
  const obj = migrateProjectJson(raw);
  const p = emptyProject(typeof obj.name === 'string' ? obj.name : undefined);
  for (const k of LIST_KEYS) if (Array.isArray(obj[k])) (p[k] as unknown[]) = obj[k] as unknown[];
  p.hiddenBuiltins = (obj.hiddenBuiltins as string[]) ?? [];
  p.propertyDefs = (obj.propertyDefs as Project['propertyDefs']) ?? [];
  p.builtinProperties = (obj.builtinProperties as Project['builtinProperties']) ?? {};
  p.builtinProfiles = (obj.builtinProfiles as Project['builtinProfiles']) ?? {};
  return p;
}

function mergeById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
  const ids = new Set(incoming.map((i) => i.id));
  return [...base.filter((b) => !ids.has(b.id)), ...incoming];
}

/** Merges every list of `incoming` into `base`; same id is replaced. */
export function mergeProjects(base: Project, incoming: Project): Project {
  const out = { ...base };
  for (const k of LIST_KEYS) (out[k] as { id: string }[]) = mergeById(base[k] as { id: string }[], incoming[k] as { id: string }[]);
  out.hiddenBuiltins = [...new Set([...base.hiddenBuiltins, ...incoming.hiddenBuiltins])];
  out.propertyDefs = mergeById(base.propertyDefs, incoming.propertyDefs);
  out.builtinProperties = { ...base.builtinProperties, ...incoming.builtinProperties };
  out.builtinProfiles = { ...base.builtinProfiles, ...incoming.builtinProfiles };
  return out;
}
