import { uniqueId } from '../ids';
import { parseYaml, type YamlValue } from './yaml';
import { renameYamlKey, setYamlIn, type YamlPath } from './yaml-edit';

/**
 * Edits of a topology file the Topo Builder makes for its panels: each rewrites only the lines it changes (see
 * yaml-edit.ts) and keeps references in step (a renamed group or pool is renamed in the link specs using it).
 */

type Obj = { [k: string]: YamlValue };
const isObj = (v: YamlValue | undefined): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Top-level keys of a topology file, in the order it writes them. */
export const TOP_KEYS = ['topology', 'version', 'device_set_groups', 'topo', 'device_labels', 'mapping'];
/** Keys of a device set group, in the order the file writes them. */
export const GROUP_KEYS = ['role', 'count', 'partitions', 'device_type', 'port_map', 'ports'];
/** Keys of a link spec, in the order the file writes them. */
export const LINK_KEYS = ['name', 'from', 'to', 'pattern', 'map'];

/** The parsed file as a map (empty when it is not one). */
export function topoDoc(src: string): Obj {
  const d = parseYaml(src);
  return isObj(d) ? d : {};
}
const groupsOf = (d: Obj): Obj => (isObj(d.device_set_groups) ? d.device_set_groups : {});
const linksOf = (d: Obj): YamlValue[] => (Array.isArray(d.topo) ? d.topo : []);
const mappingOf = (d: Obj): YamlValue[] => (Array.isArray(d.mapping) ? d.mapping : []);
const SIDES = ['from', 'to'] as const;

/** Sets (undefined: removes) a field of a device set group. */
export function setGroupField(src: string, group: string, path: YamlPath, value: YamlValue | undefined): string {
  return setYamlIn(src, ['device_set_groups', group, ...path], value, { order: GROUP_KEYS });
}

/** Sets (undefined: removes) a field of the link spec at `index` of the `topo` list. */
export function setLinkField(src: string, index: number, path: YamlPath, value: YamlValue | undefined): string {
  return setYamlIn(src, ['topo', index, ...path], value, { order: LINK_KEYS });
}

/** A group name not in the file yet. */
export function newGroupName(src: string, base = 'group'): string {
  return uniqueId(base, Object.keys(groupsOf(topoDoc(src))));
}

/** Adds a device set group after the others (created when the file has none). */
export function addGroup(src: string, name: string, group: Obj): string {
  const any = Object.keys(groupsOf(topoDoc(src))).length > 0;
  return setYamlIn(src, ['device_set_groups', name], group, { order: TOP_KEYS, depth: 2, gap: any });
}

/** Renames a group, and every link end and mapping entry naming it. */
export function renameGroup(src: string, from: string, to: string): string {
  let out = renameYamlKey(src, ['device_set_groups', from], to);
  const d = topoDoc(out);
  linksOf(d).forEach((t, i) => {
    for (const side of SIDES) if (isObj(t) && isObj(t[side]) && t[side].group === from) out = setYamlIn(out, ['topo', i, side, 'group'], to);
  });
  mappingOf(d).forEach((m, i) => { if (isObj(m) && m.group === from) out = setYamlIn(out, ['mapping', i, 'group'], to); });
  return out;
}

/** Link specs (indexes in `topo`) with an end in a group. */
export function linksOfGroup(src: string, group: string): number[] {
  return linksOf(topoDoc(src)).flatMap((t, i) => (isObj(t) && SIDES.some((s) => isObj(t[s]) && t[s].group === group) ? [i] : []));
}

/** Removes a group with the link specs and mapping entries naming it. */
export function deleteGroup(src: string, name: string): string {
  const d = topoDoc(src);
  let out = src;
  for (const i of linksOfGroup(src, name).reverse()) out = setYamlIn(out, ['topo', i], undefined);
  const maps = mappingOf(d).flatMap((m, i) => (isObj(m) && m.group === name ? [i] : []));
  for (const i of maps.reverse()) out = setYamlIn(out, ['mapping', i], undefined);
  return setYamlIn(out, ['device_set_groups', name], undefined);
}

/** Renames a group's port pool, and the link ends using it. */
export function renamePool(src: string, group: string, from: string, to: string): string {
  let out = renameYamlKey(src, ['device_set_groups', group, 'ports', from], to);
  linksOf(topoDoc(out)).forEach((t, i) => {
    for (const side of SIDES) {
      const end = isObj(t) ? t[side] : undefined;
      if (isObj(end) && end.group === group && end.ports === from) out = setYamlIn(out, ['topo', i, side, 'ports'], to);
    }
  });
  return out;
}

/** A link spec name not in the file yet. */
export function newLinkName(src: string, base = 'link'): string {
  return uniqueId(base, linksOf(topoDoc(src)).flatMap((t) => (isObj(t) && typeof t.name === 'string' ? [t.name] : [])));
}

/** Appends a link spec to `topo` (created when missing); returns the source and the spec's index. */
export function addLink(src: string, link: Obj): { source: string; index: number } {
  const n = linksOf(topoDoc(src)).length;
  return { source: setYamlIn(src, ['topo', n], link, { order: TOP_KEYS, depth: 1, gap: n > 0 }), index: n };
}

/** Removes the link spec at `index` of `topo`. */
export function deleteLink(src: string, index: number): string {
  return setYamlIn(src, ['topo', index], undefined);
}
