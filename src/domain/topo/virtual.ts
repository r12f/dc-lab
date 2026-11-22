import { parseYaml, YamlError, type YamlValue } from './yaml';
import type { DiagramView } from './diagram';
import type { TopoBomSettings } from './bom';

export const TOPOLOGY_SCHEMA = 'dc-lab/topology@1';

/** A topology file kept in the project: its YAML source (spec/10-topology-compiler.md). */
export interface Topology {
  schema?: typeof TOPOLOGY_SCHEMA;
  id: string;
  name: string;
  source: string;
  /** Diagram view: moved and collapsed group boxes. */
  view?: DiagramView;
  /** Hardware assumed for the estimated BOM (device type per group, optic per pool, item per line). */
  bom?: TopoBomSettings;
}

export interface Partition { key: string; count: number; size: number; sizes?: Record<string, number>; /** Shape holds inside each set of these keys. */ per?: string[] }
export interface VGroup {
  name: string;
  role: string;
  count: number;
  partitions: Partition[];
  /** Pool name -> number of ports. */
  pools: Record<string, number>;
  /** Pool name -> ports per top-level list entry (a pool listed as several entries, e.g. one per peer slot). */
  poolSlots: Record<string, number[]>;
  /** Pool name -> its port names, in pool order. */
  poolNames: Record<string, string[]>;
}
export interface VEnd { group: string; key?: string; ports: string; filters: Record<string, string> }
export interface VLink {
  name: string;
  from: VEnd;
  to: VEnd;
  pattern: 'mesh' | 'round-robin';
  perPair: number;
  map: { from: string[]; to: string }[];
  /** Links the spec generates, from partition sizes (undefined when it cannot be derived). */
  links?: number;
  /** Instance pairs (from instances that find a peer). */
  pairs?: number;
  /** Devices in one from / to instance (after filters). */
  fromSize?: number;
  toSize?: number;
  /** From instances per to instance (map fan-in; 1 without a map). */
  fanIn?: number;
  /** Ports one from / to device uses for this spec. */
  fromPorts?: number;
  toPorts?: number;
}
export interface Problem { line?: number; message: string }
export interface VirtualTopo { name: string; groups: VGroup[]; links: VLink[]; problems: Problem[] }

type Obj = { [k: string]: YamlValue };
const isObj = (v: YamlValue | undefined): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: YamlValue | undefined) => (v === undefined || v === null ? undefined : String(v));
const num = (v: YamlValue | undefined) => (typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : undefined);

/** Expands one pool entry: `etp{1-2}{a-c}`, `x{1,7}`, zero-padded ranges keep their width. */
export function expandPorts(pat: string): string[] {
  const m = /\{([^}]*)\}/.exec(pat);
  if (!m) return [pat];
  const items: string[] = [];
  for (const part of m[1].split(',')) {
    const r = /^([^-]+)-([^-]+)$/.exec(part);
    if (r && /^\d+$/.test(r[1]) && /^\d+$/.test(r[2])) {
      const w = r[1].startsWith('0') ? r[1].length : 0;
      for (let i = Number(r[1]); i <= Number(r[2]); i++) items.push(String(i).padStart(w, '0'));
    } else if (r && r[1].length === 1 && r[2].length === 1) {
      for (let c = r[1].charCodeAt(0); c <= r[2].charCodeAt(0); c++) items.push(String.fromCharCode(c));
    } else items.push(part);
  }
  return items.flatMap((it) => expandPorts(pat.slice(0, m.index) + it + pat.slice(m.index + m[0].length)));
}

/** A pool: a string or (nested) list of entries, in order. */
export function poolPorts(v: YamlValue | undefined): string[] {
  if (typeof v === 'string') return expandPorts(v);
  if (Array.isArray(v)) return v.flatMap(poolPorts);
  return [];
}

/** Numbers in a filter range: "1-15", "3", "1-3,7". */
function rangeSize(v: string): number | undefined {
  let n = 0;
  for (const part of v.split(',')) {
    const r = /^(\d+)-(\d+)$/.exec(part.trim());
    if (r) n += Number(r[2]) - Number(r[1]) + 1;
    else if (/^\d+$/.test(part.trim())) n += 1;
    else return undefined;
  }
  return n;
}

/** Variables of a key template: "${su}.${plane}" -> [su, plane]. */
export function keyVars(key: string): string[] {
  return [...key.matchAll(/\$\{([\w.]+)\}/g)].map((m) => m[1]);
}

/** Parses the virtual part (device_set_groups + topo) of a topology file. */
export function parseVirtual(source: string): VirtualTopo {
  const problems: Problem[] = [];
  let doc: YamlValue;
  try {
    doc = parseYaml(source);
  } catch (e) {
    return { name: '', groups: [], links: [], problems: [{ line: e instanceof YamlError ? e.line : undefined, message: (e as Error).message }] };
  }
  if (!isObj(doc)) return { name: '', groups: [], links: [], problems: [{ message: 'The file must be a map (topology, device_set_groups, topo, ...).' }] };
  const groups: VGroup[] = [];
  const dsg = doc.device_set_groups;
  if (!isObj(dsg)) problems.push({ message: 'device_set_groups: missing or not a map' });
  else for (const [name, g] of Object.entries(dsg)) {
    if (!isObj(g)) { problems.push({ message: `group ${name}: not a map` }); continue; }
    const count = num(g.count);
    if (count === undefined) problems.push({ message: `group ${name}: count missing` });
    if (!str(g.role)) problems.push({ message: `group ${name}: role missing` });
    const partitions: Partition[] = [];
    for (const p of Array.isArray(g.partitions) ? g.partitions : []) {
      if (!isObj(p) || !str(p.key)) { problems.push({ message: `group ${name}: partition needs a key` }); continue; }
      if (isObj(p.sizes)) {
        const sizes = Object.fromEntries(Object.entries(p.sizes).map(([k, v]) => [k, num(v) ?? 0]));
        const total = Object.values(sizes).reduce((a, b) => a + b, 0);
        if (count !== undefined && total !== count) problems.push({ message: `group ${name}: partition ${p.key} sizes add up to ${total}, count is ${count}` });
        partitions.push({ key: String(p.key), count: Object.keys(sizes).length, size: 0, sizes });
        continue;
      }
      const c = num(p.count); const s = num(p.size);
      if (c === undefined || s === undefined) { problems.push({ message: `group ${name}: partition ${p.key} needs count and size (or sizes)` }); continue; }
      const per = Array.isArray(p.per) ? p.per.map(String) : [];
      if (!per.length && count !== undefined && c * s !== count) problems.push({ message: `group ${name}: partition ${p.key} is ${c} x ${s} = ${c * s}, count is ${count}` });
      partitions.push({ key: String(p.key), count: c, size: s, ...(per.length ? { per } : {}) });
    }
    const pools: Record<string, number> = {};
    const poolSlots: Record<string, number[]> = {};
    const poolNames: Record<string, string[]> = {};
    if (isObj(g.ports)) for (const [k, v] of Object.entries(g.ports)) {
      poolNames[k] = poolPorts(v);
      pools[k] = poolNames[k].length;
      if (Array.isArray(v) && v.length > 1) poolSlots[k] = v.map((e) => poolPorts(e).length);
    }
    groups.push({ name, role: str(g.role) ?? '', count: count ?? 0, partitions, pools, poolSlots, poolNames });
  }
  const byName = new Map(groups.map((g) => [g.name, g]));
  const links: VLink[] = [];
  const topo = doc.topo;
  if (topo !== undefined && !Array.isArray(topo)) problems.push({ message: 'topo: must be a list' });
  for (const t of Array.isArray(topo) ? topo : []) {
    if (!isObj(t)) continue;
    const name = str(t.name) ?? `link ${links.length + 1}`;
    const end = (v: YamlValue | undefined, side: string): VEnd | undefined => {
      if (!isObj(v)) { problems.push({ message: `${name}: ${side} missing` }); return undefined; }
      const group = str(v.group) ?? '';
      const g = byName.get(group);
      if (!g) problems.push({ message: `${name}: ${side} group "${group}" is not defined` });
      const ports = str(v.ports) ?? '';
      if (g && !(ports in g.pools)) problems.push({ message: `${name}: ${side} group ${group} has no port pool "${ports}"` });
      const key = str(v.key);
      if (key !== undefined && !keyVars(key).length) problems.push({ message: `${name}: ${side} key "${key}" has no \${variable}` });
      for (const k of key ? keyVars(key) : []) {
        if (g && !g.partitions.some((p) => p.key === k)) problems.push({ message: `${name}: ${side} key uses \${${k}}, not a partition key of ${group}` });
      }
      const filters: Record<string, string> = {};
      if (isObj(v.filters)) for (const [k, fv] of Object.entries(v.filters)) {
        filters[k] = String(fv);
        const base = k.endsWith('.index') ? k.slice(0, -6) : k;
        if (g && !g.partitions.some((p) => p.key === base)) problems.push({ message: `${name}: ${side} filter ${k}: ${base} is not a partition key of ${group}` });
      }
      return { group, key, ports, filters };
    };
    const from = end(t.from, 'from'); const to = end(t.to, 'to');
    const pt = isObj(t.pattern) ? t.pattern : {};
    const type = str(pt.type);
    if (type !== 'mesh' && type !== 'round-robin') problems.push({ message: `${name}: pattern type must be mesh or round-robin` });
    const map = (Array.isArray(t.map) ? t.map : []).filter(isObj).map((m) => ({
      from: (Array.isArray(m.from) ? m.from : [m.from]).map((x) => String(x)), to: String(m.to),
    }));
    for (const m of Array.isArray(t.map) ? t.map : []) {
      if (isObj(m) && (typeof m.to !== 'string' || (Array.isArray(m.from) && m.from.some((x) => typeof x !== 'string')))) {
        problems.push({ message: `${name}: map values must be strings ("1", not 1)` }); break;
      }
    }
    if (!from || !to) continue;
    const link: VLink = { name, from, to, pattern: type === 'round-robin' ? 'round-robin' : 'mesh', perPair: num(pt.per_pair) ?? 1, map };
    Object.assign(link, linkCount(link, byName));
    links.push(link);
  }
  for (const l of links) {
    const ga = byName.get(l.from.group); const gb = byName.get(l.to.group);
    const a = ga && instances(ga, l.from); const b = gb && instances(gb, l.to);
    if (!ga || !gb || !a || !b) continue;
    for (const [side, g, e] of [['from', ga, l.from], ['to', gb, l.to]] as const) {
      const need = devicePorts(l, side, a, b);
      const have = g.pools[e.ports] ?? 0;
      if (side === 'from') { l.fromPorts = need; l.fromSize = a.size; } else { l.toPorts = need; l.toSize = b.size; }
      l.fanIn = l.map.length ? Math.max(...l.map.map((m) => m.from.length)) : 1;
      if (need > have) problems.push({ message: `${l.name}: each ${g.name} device needs ${need} ports, pool ${e.ports} has ${have}` });
    }
  }
  return { name: str(doc.topology) ?? '', groups, links, problems };
}

/** Instances of an end: how many, devices per instance (mean), and devices in the largest instance. */
interface Inst { n: number; size: number; max: number }

function instances(g: VGroup, e: VEnd): Inst | undefined {
  const vars = e.key ? keyVars(e.key) : [];
  let n = 1;
  for (const v of vars) {
    const p = g.partitions.find((x) => x.key === v);
    if (!p) return undefined;
    n *= p.count;
  }
  let size = g.count / n;
  // Uneven sets (`sizes`): the largest one bounds the ports a device needs.
  let max = size;
  for (const v of vars) {
    const p = g.partitions.find((x) => x.key === v)!;
    if (p.sizes && vars.length === 1) max = Math.max(...Object.values(p.sizes));
  }
  for (const [k, v] of Object.entries(e.filters)) {
    const p = g.partitions.find((x) => x.key === (k.endsWith('.index') ? k.slice(0, -6) : k));
    if (!p) return undefined;
    if (k.endsWith('.index')) {
      const r = rangeSize(v);
      if (r === undefined || !p.size) return undefined;
      size = (size * r) / p.size;
      max = (max * r) / p.size;
    } else {
      const share = p.sizes ? (p.sizes[v] ?? 0) / g.count : 1 / p.count;
      if (vars.includes(p.key)) { n = Math.max(1, n / p.count); } else { size *= share; max *= share; }
    }
  }
  return { n, size, max };
}

/** Ports one device of a side needs: its peers times per_pair. */
function devicePorts(l: VLink, side: 'from' | 'to', a: Inst, b: Inst): number {
  // With a map, one to-instance takes several from-instances.
  const fanIn = l.map.length ? Math.max(...l.map.map((m) => m.from.length)) : 1;
  if (l.pattern === 'mesh') return (side === 'from' ? b.max : a.max * fanIn) * l.perPair;
  return (side === 'from' ? 1 : Math.ceil((a.max * fanIn) / b.size)) * l.perPair;
}

function linkCount(l: VLink, groups: Map<string, VGroup>): Pick<VLink, 'links' | 'pairs'> {
  const ga = groups.get(l.from.group); const gb = groups.get(l.to.group);
  if (!ga || !gb) return {};
  const a = instances(ga, l.from); const b = instances(gb, l.to);
  if (!a || !b) return {};
  const pairs = l.map.length ? l.map.reduce((n, m) => n + m.from.length, 0) : a.n;
  const same = l.from.group === l.to.group;
  const per = l.pattern === 'mesh'
    ? (same ? (a.size * (a.size - 1)) / 2 : a.size * b.size)
    : a.size;
  return { pairs, links: Math.round(pairs * per * l.perPair) };
}
