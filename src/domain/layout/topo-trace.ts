import type { Library } from '../library/library';
import type { CableEndpoint, RackDesign } from '../design/types';
import { cableGroupsOnFace, drawOrder, formatPortRef } from '../device/ports';
import type { DeviceDefinition, PortGroup } from '../device/types';
import type { DcLayout } from './types';
import type { DesignLookup } from './tiles';
import type { Placement } from '../design/types';
import { placedDevice } from '../design/sizing';
import { unitsIn } from '../units';
import { CATEGORY_TRAITS } from '../device/categories';

/** A port of a device in a rack of the layout. */
export interface TracePort { assignmentId: string; placementId: string; portRef: string }

/** One end of a trace: a rack and the ports picked in it (any devices, any ports); none picked = the whole rack. */
export interface TraceSide { assignmentId: string; ports?: { placementId: string; portRef: string }[] }

/** `cable` = in-rack cable, `cross` = cross-rack cable, `pass` = a pass-through panel's front port to its rear twin. */
export type TraceLinkKind = 'cable' | 'cross' | 'pass';

/** `cable` = the physical cable it rides on (`<rack>/<run id>`, `x/<cross cable id>`), so links count as cables. */
export interface TraceLink { a: string; b: string; kind: TraceLinkKind; mediaId?: string; cable?: string }

/** A traced topology, kept for the session (not saved in the project). */
export interface TopoTrace {
  id: string;
  name: string;
  layoutId: string;
  a: TraceSide;
  b?: TraceSide;
  /** Keys (`tracePortKey`) of the A side's ports. */
  start: string[];
  links: TraceLink[];
}

/**
 * Key of a port in the trace graph. Ports with several connectors (a housing slot with 2x MMC-16) are separate
 * per connector (`~2`): connector A of a pass-through slot only continues to connector A on the other face.
 */
export const tracePortKey = (p: TracePort, connector?: number) => `${p.assignmentId}#${p.placementId}#${p.portRef}${connector ? `~${connector}` : ''}`;

/** Connector legs of a group that the trace keeps apart (only multi-connector ports). */
const legsOf = (g: PortGroup | undefined) => ((g?.connectorsPerPort ?? 1) > 1 ? g!.connectorsPerPort! : 0);
const groupOfRef = (portRef: string) => portRef.split('~')[0].split('/')[0];

export function parseTracePortKey(key: string): TracePort {
  const [assignmentId, placementId, ...rest] = key.split('#');
  return { assignmentId, placementId, portRef: rest.join('#') };
}

/** Devices with pass-through port groups (fiber housings, RJ45 coupler panels…): port i continues on the other face. */
export const hasPassThrough = (d: DeviceDefinition | undefined) => !!d?.ports.some((g) => g.passThrough);

const POWER_ROLES = new Set<PortGroup['role']>(['inlet', 'outlet']);

/** Cable ports of a device on both faces; power inlets / outlets only when `power` is set. */
function devicePorts(device: DeviceDefinition, power: boolean): string[] {
  const out: string[] = [];
  for (const face of ['front', 'rear'] as const) {
    for (const g of cableGroupsOnFace(device, face)) {
      if (!power && POWER_ROLES.has(g.role)) continue;
      for (let i = 1; i <= g.count; i++) out.push(formatPortRef({ groupId: g.id, index: i }));
    }
  }
  return out;
}

/**
 * Ports of a trace side: the picked ports; none picked = every data / mgmt / console port of every device in the
 * rack (power inlets and outlets count only when picked).
 */
export function sidePorts(lib: Library, designs: DesignLookup, layout: DcLayout, side: TraceSide): string[] {
  const a = layout.assignments.find((x) => x.id === side.assignmentId);
  const design = a && designs(a.designId);
  if (!a || !design) return [];
  // One key per connector of a multi-connector port.
  const keys = (placementId: string, portRef: string) => {
    const pl = design.placements.find((x) => x.id === placementId);
    const g = pl && lib.devices.get(pl.deviceId)?.ports.find((x) => x.id === groupOfRef(portRef));
    const n = legsOf(g);
    const base = { assignmentId: a.id, placementId, portRef };
    return n ? Array.from({ length: n }, (_, i) => tracePortKey(base, i + 1)) : [tracePortKey(base)];
  };
  if (side.ports?.length) return side.ports.flatMap((x) => keys(x.placementId, x.portRef));
  const out: string[] = [];
  for (const p of design.placements) {
    const d = lib.devices.get(p.deviceId);
    if (d) for (const portRef of devicePorts(d, false)) out.push(...keys(p.id, portRef));
  }
  return out;
}

/**
 * Fiber pairs of a cable between its A connectors (n) and B connectors (m): one to one when n = m, each connector
 * of the smaller end to its share of the larger end when one count divides the other (10x MMC-16 to 20x MPO-8:
 * MMC i -> MPO 2i-1, 2i), else every A connector to every B connector (shuffles).
 */
export function cablePairs(n: number, m: number, shuffle = false): [number, number][] {
  const out: [number, number][] = [];
  if (!shuffle && n && m && (n % m === 0 || m % n === 0)) {
    const r = Math.max(n, m) / Math.min(n, m);
    for (let i = 0; i < Math.max(n, m); i++) out.push(n >= m ? [i, Math.floor(i / r)] : [Math.floor(i / r), i]);
    return out;
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) out.push([i, j]);
  return out;
}

type Adj = Map<string, { to: string; link: TraceLink }[]>;

export interface RackPortDevice {
  placement: Placement;
  faces: { face: 'front' | 'rear'; groups: PortGroup[] }[];
}

/**
 * Every cable port of a rack's devices, laid out like its cabling view: rack devices top to bottom, then side
 * devices; each face's groups in drawing order. Devices without cable ports (fillers) are left out.
 */
export function rackPortLayout(lib: Library, design: RackDesign): RackPortDevice[] {
  const rack = lib.racks.get(design.templateId);
  const top = (p: Placement) => {
    if (p.mount.kind !== 'rack') return -Infinity;
    const d = placedDevice(lib, design, p);
    return p.mount.position + (d && rack ? Math.max(1, unitsIn(d.height, rack.unitSystem)) : 1) - 1;
  };
  const out: RackPortDevice[] = [];
  for (const p of [...design.placements].sort((a, b) => top(b) - top(a))) {
    const device = placedDevice(lib, design, p);
    if (!device) continue;
    const faces = (['front', 'rear'] as const).map((face) => ({ face, groups: drawOrder(cableGroupsOnFace(device, face)) }))
      .filter((f) => f.groups.length);
    if (faces.length) out.push({ placement: p, faces });
  }
  return out;
}

/** Port graph of the whole layout: in-rack cables, cross-rack cables and pass-through panels. */
export function traceGraph(lib: Library, designs: DesignLookup, layout: DcLayout): Adj {
  const adj: Adj = new Map();
  const seen = new Set<string>();
  const add = (link: TraceLink) => {
    if (link.a === link.b) return;
    const k = [link.a, link.b].sort().join('|') + link.kind;
    if (seen.has(k)) return;
    seen.add(k);
    for (const [u, v] of [[link.a, link.b], [link.b, link.a]]) {
      const l = adj.get(u) ?? [];
      l.push({ to: v, link });
      adj.set(u, l);
    }
  };
  // assignment -> placement -> group id -> connectors kept apart (multi-connector groups only).
  const legs = new Map<string, number>();
  for (const a of layout.assignments) {
    for (const p of designs(a.designId)?.placements ?? []) {
      for (const g of lib.devices.get(p.deviceId)?.ports ?? []) if (legsOf(g)) legs.set(`${a.id}#${p.id}#${g.id}`, legsOf(g));
    }
  }
  const endKey = (aid: string, e: CableEndpoint) => {
    const multi = legs.has(`${aid}#${e.placementId}#${groupOfRef(e.portRef)}`);
    return tracePortKey({ assignmentId: aid, placementId: e.placementId, portRef: e.portRef }, multi ? e.connector ?? 1 : undefined);
  };
  const cable = (aid: string, from: CableEndpoint[], to: CableEndpoint[], mediaId: string, kind: TraceLinkKind, bid: string, cableId: string) => {
    const m = lib.cableMedia.get(mediaId);
    for (const [i, j] of cablePairs(from.length, to.length, m?.mapping === 'shuffle')) {
      const x = from[i];
      const y = to[j];
      if (!x?.portRef || !y?.portRef) continue;
      add({ kind, mediaId, cable: cableId, a: endKey(aid, x), b: endKey(bid, y) });
    }
  };
  for (const a of layout.assignments) {
    const design: RackDesign | undefined = designs(a.designId);
    if (!design) continue;
    for (const run of design.cables) cable(a.id, run.from, run.to, run.mediaId, 'cable', a.id, `${a.id}/${run.id}`);
    // Pass-through groups (from the device model): port i of the group continues as port i of its other face.
    for (const p of design.placements) {
      const d = lib.devices.get(p.deviceId);
      for (const g of d?.ports ?? []) {
        if (!g.passThrough) continue;
        // Connector c of port i continues as connector c of port i (multi-connector slots per connector).
        const cs = legsOf(g) ? Array.from({ length: legsOf(g) }, (_, k) => k + 1) : [undefined];
        for (let i = 1; i <= g.count; i++) {
          for (const c of cs) {
            add({ kind: 'pass', a: tracePortKey({ assignmentId: a.id, placementId: p.id, portRef: formatPortRef({ groupId: g.id, index: i }) }, c),
              b: tracePortKey({ assignmentId: a.id, placementId: p.id, portRef: formatPortRef({ groupId: g.passThrough.rearId, index: i }) }, c) });
          }
        }
      }
    }
  }
  for (const c of layout.crossCables ?? []) {
    const ia = c.from[0]?.assignmentId;
    const ib = c.to[0]?.assignmentId;
    if (ia && ib) cable(ia, c.from, c.to, c.mediaId, 'cross', ib, `x/${c.id}`);
  }
  return adj;
}

/**
 * Node of the walk a port belongs to: its device for data ports (traffic crosses a switch / server from any data port
 * to any other), else the port itself (pass-through ports continue only to their twin; mgmt / console / power ports
 * are endpoints).
 */
type NodeOf = (portKey: string) => string;

function nodeFn(lib: Library, designs: DesignLookup, layout: DcLayout): NodeOf {
  // assignment#placement -> port group id -> whether traffic crosses the device through it: DATA ports only. Mgmt,
  // console and power ports are reached but never transited (else every switch would connect to every other through
  // the management switch or the PDU feeding them); pass-through groups only continue to their own twin port.
  const transit = new Map<string, Map<string, boolean>>();
  for (const a of layout.assignments) {
    for (const p of designs(a.designId)?.placements ?? []) {
      const d = lib.devices.get(p.deviceId);
      if (!d) continue;
      const m = new Map<string, boolean>();
      for (const g of cableGroupsOnFace(d, 'front').concat(cableGroupsOnFace(d, 'rear'))) m.set(g.id, g.role === 'data' && !g.passThrough && !g.passThroughOf);
      transit.set(`${a.id}#${p.id}`, m);
    }
  }
  return (k) => {
    const p = parseTracePortKey(k);
    const d = `${p.assignmentId}#${p.placementId}`;
    return transit.get(d)?.get(groupOfRef(p.portRef)) ? d : k;
  };
}

/**
 * Breadth-first walk from `start`: a port reached joins the set; reaching a device (any port of it) reaches all its
 * cabled ports, so the walk goes through switches and servers. A port already in the set is not walked again. Returns
 * the ports reached and every link walked.
 */
function expand(adj: Adj, start: string[], nodeOf: NodeOf): { ports: Set<string>; links: TraceLink[] } {
  const members = new Map<string, string[]>();
  for (const k of adj.keys()) { const n = nodeOf(k); members.set(n, [...(members.get(n) ?? []), k]); }
  const ports = new Set<string>();
  const nodes = new Set<string>();
  const links = new Set<TraceLink>();
  const queue: string[] = [];
  const reach = (k: string) => {
    if (ports.has(k)) return;
    ports.add(k);
    queue.push(k);
    const n = nodeOf(k);
    if (nodes.has(n)) return;
    nodes.add(n);
    for (const m of members.get(n) ?? []) reach(m);
  };
  for (const k of start) reach(k);
  while (queue.length) {
    const u = queue.shift()!;
    for (const { to, link } of adj.get(u) ?? []) { links.add(link); reach(to); }
  }
  return { ports, links: [...links] };
}

/**
 * Cost of entering a node: devices TRANSITED count 1; pass-through ports (a fiber housing adds no hop) and the nodes of
 * the two sides themselves count 0, so a path is measured in devices crossed between A and B whichever A / B port
 * (server or housing) it starts and ends on.
 */
const nodeWeight = (n: string) => (free.has(n) ? 0 : 1);
let free = new Set<string>();

/**
 * Distance from the nodes of `start` to every node reached, counted in DEVICES crossed (node-weighted, 0-1 breadth
 * first): pass-through ports weigh 0, so SW -> FH -> trunk -> FH -> SW is one hop, as on the drawing.
 */
function hops(adj: Adj, start: string[], nodeOf: NodeOf): Map<string, number> {
  const members = new Map<string, string[]>();
  for (const k of adj.keys()) { const n = nodeOf(k); members.set(n, [...(members.get(n) ?? []), k]); }
  const dist = new Map<string, number>();
  const deque: string[] = [];
  for (const n of new Set(start.map(nodeOf))) { dist.set(n, nodeWeight(n)); deque.push(n); }
  while (deque.length) {
    const n = deque.shift()!;
    const dn = dist.get(n)!;
    for (const k of members.get(n) ?? []) {
      for (const { to } of adj.get(k) ?? []) {
        const m = nodeOf(to);
        const w = nodeWeight(m);
        if (dn + w >= (dist.get(m) ?? Infinity)) continue;
        dist.set(m, dn + w);
        if (w === 0) deque.unshift(m); else deque.push(m);
      }
    }
  }
  return dist;
}

/**
 * Traces from side A outward, breadth first, over cables, cross-rack cables, pass-through panels and through devices
 * (a switch reached on one port continues on all its others). Without B: everything connected to A. With B: the
 * SHORTEST paths from A to B, counted in devices crossed (fiber housings / pass-through ports cost nothing): a link is
 * kept when the devices from A up to one end plus from the other end on to B equal the A-to-B distance.
 */
export function traceTopology(lib: Library, designs: DesignLookup, layout: DcLayout, a: TraceSide, b?: TraceSide): { start: string[]; links: TraceLink[] } {
  const adj = traceGraph(lib, designs, layout);
  const nodeOf = nodeFn(lib, designs, layout);
  const start = sidePorts(lib, designs, layout, a);
  if (!b) return { start, links: expand(adj, start, nodeOf).links };
  const end = sidePorts(lib, designs, layout, b);
  free = new Set([...[...adj.values()].flat().filter((x) => x.link.kind === 'pass').flatMap((x) => [x.link.a, x.link.b]), ...[...start, ...end].map(nodeOf)]);
  const dA = hops(adj, start, nodeOf);
  const dB = hops(adj, end, nodeOf);
  const goal = Math.min(...[...new Set(end.map(nodeOf))].map((n) => dA.get(n) ?? Infinity));
  // A link u-v is on a shortest path when the devices crossed from A up to u plus from v on to B add up to the goal.
  if (!Number.isFinite(goal)) return { start, links: [] };
  // Inside each side, everything cabled within it is shown too (a rack side's servers behind its fiber housing):
  // the path reaches the side's nearest port, the side's own links show how it fans out to the rest.
  const sideA = new Set(start);
  const sideB = new Set(end);
  const seen = new Set<TraceLink>();
  for (const l of [...adj.values()].flat().map((x) => x.link)) {
    const [u, v] = [nodeOf(l.a), nodeOf(l.b)];
    const on = (x: string, y: string) => (dA.get(x) ?? Infinity) + (dB.get(y) ?? Infinity) === goal;
    const within = (s: Set<string>) => s.has(l.a) && s.has(l.b);
    if (on(u, v) || on(v, u) || within(sideA) || within(sideB)) seen.add(l);
  }
  return { start, links: [...seen] };
}

// ------------------------------------------------------------------------------------------------ drawing layout

export interface TraceNode {
  /** `assignmentId#placementId`, or `rack:assignmentId@column` for a collapsed rack. */
  key: string;
  assignmentId: string;
  placementId: string;
  rack: string;
  label: string;
  /** Second line: the device type, or a collapsed rack's device summary. */
  sub: string;
  device?: DeviceDefinition;
  /** Collapsed rack block: the devices it stands for. */
  devices?: number;
  /** Hops (device to device) from side A. */
  column: number;
  side?: 'a' | 'b';
  ports: number;
  x: number; y: number; w: number; h: number;
}

/**
 * One line of the drawing: the cables of ONE cable type between two boxes. `count` = ports joined (the larger of the
 * two ends' distinct port counts; a shuffle's all-to-all pairs count once), `cables` = physical cables.
 * `index` / `of`: this line among the lines of the same box pair (parallel lines are offset).
 * `lane` (same-column edges only): bracket lane left of the column, 0 = innermost; lanes never overlap.
 */
export interface TraceEdge {
  a: string; b: string; mediaId: string; media: string; color: string; count: number; cables: number; kinds: TraceLinkKind[];
  index: number; of: number; lane?: number;
}

export interface TraceRackBox {
  /** Collapse key of the block: `assignmentId@column`, or `design:designId@column` for merged racks of one design. */
  key: string;
  /** Racks in this block (more than 1 = a design group holding every rack of one design in the column). */
  racks: number;
  /** 0 = top level (a design group, or a rack alone in its design), 1 = a rack inside an open design group. */
  level: 0 | 1;
  assignmentId: string;
  label: string;
  collapsed: boolean;
  devices: number;
  x: number; y: number; w: number; h: number;
}

export interface TraceDrawing { nodes: TraceNode[]; edges: TraceEdge[]; racks: TraceRackBox[]; width: number; height: number }

export const TRACE_GEOM = { nodeW: 200, nodeH: 44, colGap: 140, rowGap: 14, rackPad: 10, rackHead: 22, margin: 24, lane: 10, groupPad: 8 } as const;

/** Rack blocks with more devices than this start collapsed. */
export const TRACE_COLLAPSE_OVER = 8;

const deviceKey = (portKey: string) => { const p = parseTracePortKey(portKey); return `${p.assignmentId}#${p.placementId}`; };

/**
 * Links with the pass-through devices (fiber housings, patch panels) taken out: every chain of pass-through ports
 * (front ↔ rear twins, trunks between housings) is followed, and the ports at its two ends — a switch / server port on
 * each side — get one direct link. Its type names the cables of the chain ("Y cable → trunk → Y cable"), cross-rack
 * when any part was. Links that touch no pass-through port are kept as they are.
 */
export function bypassPassThrough(lib: Library, links: TraceLink[]): TraceLink[] {
  const pass = new Set(links.filter((l) => l.kind === 'pass').flatMap((l) => [l.a, l.b]));
  if (!pass.size) return links;
  // Union-find over pass-through ports joined by any link between two of them.
  const parent = new Map<string, string>();
  const find = (x: string): string => { const p = parent.get(x) ?? x; if (p === x) return x; const r = find(p); parent.set(x, r); return r; };
  for (const l of links) if (pass.has(l.a) && pass.has(l.b)) parent.set(find(l.a), find(l.b));
  // Per chain: the outside ports touching it, the cable types and whether any part is cross-rack.
  const chains = new Map<string, { ends: Set<string>; media: Set<string>; cross: boolean }>();
  const chain = (k: string) => { const r = find(k); let c = chains.get(r); if (!c) { c = { ends: new Set(), media: new Set(), cross: false }; chains.set(r, c); } return c; };
  const out: TraceLink[] = [];
  for (const l of links) {
    const [pa, pb] = [pass.has(l.a), pass.has(l.b)];
    if (!pa && !pb) { out.push(l); continue; }
    const c = chain(pa ? l.a : l.b);
    if (pa !== pb) c.ends.add(pa ? l.b : l.a);
    if (l.mediaId) c.media.add(lib.cableMedia.get(l.mediaId)?.name ?? l.mediaId);
    if (l.kind === 'cross') c.cross = true;
  }
  for (const [r, c] of chains) {
    const ends = [...c.ends].sort();
    const via = [...c.media].sort().join(' + ') || 'pass-through';
    for (let i = 0; i < ends.length; i++) {
      for (let j = i + 1; j < ends.length; j++) {
        out.push({ a: ends[i], b: ends[j], kind: c.cross ? 'cross' : 'cable', mediaId: `via:${via}`, cable: `chain/${r}/${ends[i]}/${ends[j]}` });
      }
    }
  }
  return out;
}

/** Collapse keys (`assignmentId@column`) of the blocks that start collapsed: those with many devices. */
export function defaultCollapsed(lib: Library, designs: DesignLookup, layout: DcLayout, trace: TopoTrace, hidePass = false): Set<string> {
  const d = traceDrawing(lib, designs, layout, trace, new Set(), hidePass);
  // Design groups start collapsed, and so do big racks (seen when a group is opened).
  return new Set(d.racks.filter((r) => r.racks > 1 || r.devices > TRACE_COLLAPSE_OVER).map((r) => r.key));
}

/** "7x Console Server, 5x Switch": device count per category, largest first. */
function summary(nodes: TraceNode[]): string {
  const n = new Map<string, number>();
  for (const x of nodes) { const c = x.device?.category ?? 'other'; n.set(c, (n.get(c) ?? 0) + 1); }
  return [...n].sort((a, b) => b[1] - a[1]).map(([c, k]) => `${k}x ${CATEGORY_TRAITS[c as keyof typeof CATEGORY_TRAITS]?.label ?? c}`).join(', ');
}

/**
 * Device-level picture of a trace: one box per device that has a traced port, in columns by hops from side A,
 * devices of one rack stacked in a rack block; one edge per device pair with its port count and cable types. A
 * collapsed block shows one summary box; its devices' edges attach to it (summed), edges inside it are dropped.
 * Same-column edges bracket out to the left on lanes that never overlap; columns widen to fit the lanes.
 */
export function traceDrawing(lib: Library, designs: DesignLookup, layout: DcLayout, trace0: TopoTrace, collapsed: ReadonlySet<string> = new Set(), hidePass = false): TraceDrawing {
  const G = TRACE_GEOM;
  // Hiding pass-through devices: their chains become direct links; their ports are not drawn (nor start / end there).
  const passPorts = hidePass ? new Set(trace0.links.filter((l) => l.kind === 'pass').flatMap((l) => [l.a, l.b])) : new Set<string>();
  const trace = hidePass ? { ...trace0, links: bypassPassThrough(lib, trace0.links), start: trace0.start.filter((k) => !passPorts.has(k)) } : trace0;
  const ports = new Map<string, Set<string>>();
  const touch = (k: string) => { const d = deviceKey(k); const s = ports.get(d) ?? new Set(); s.add(k); ports.set(d, s); };
  for (const l of trace.links) { touch(l.a); touch(l.b); }
  const startDevs = new Set(trace.start.map(deviceKey).filter((d) => ports.has(d)));
  if (!ports.size) for (const k of trace.start) { touch(k); startDevs.add(deviceKey(k)); }
  const bSide = trace.b ? new Set(sidePorts(lib, designs, layout, trace.b).filter((k) => !passPorts.has(k)).map(deviceKey)) : new Set<string>();
  // Device-level edges (links inside one device, e.g. pass-through, are not drawn).
  const devEdges = new Map<string, { a: string; b: string; mediaId: string; ends: [Set<string>, Set<string>]; cables: Set<string>; kinds: TraceLinkKind[] }>();
  for (const l of trace.links) {
    const [x, y] = [deviceKey(l.a), deviceKey(l.b)];
    if (x === y) continue;
    const [a, b] = [x, y].sort();
    const mediaId = l.mediaId ?? '';
    const ek = `${a}|${b}|${mediaId}`;
    const e = devEdges.get(ek) ?? { a, b, mediaId, ends: [new Set<string>(), new Set<string>()], cables: new Set<string>(), kinds: [] };
    const [pa, pb] = x === a ? [l.a, l.b] : [l.b, l.a];
    e.ends[0].add(pa); e.ends[1].add(pb);
    if (l.cable) e.cables.add(l.cable);
    if (!e.kinds.includes(l.kind)) e.kinds.push(l.kind);
    devEdges.set(ek, e);
  }
  // Columns: devices crossed from A, measured on the PORT graph (a housing is many independent ports, not one hub —
  // as a device node it would join unrelated paths at no cost). Pass-through ports cost 0, so cables through fiber
  // housings add no level; then each pass-through device takes the column of the device it serves in its own rack.
  const walkNode = nodeFn(lib, designs, layout);
  const passPort = new Set(trace.links.filter((l) => l.kind === 'pass').flatMap((l) => [l.a, l.b]));
  const portAdj = new Map<string, string[]>();
  for (const l of trace.links) { portAdj.set(l.a, [...(portAdj.get(l.a) ?? []), l.b]); portAdj.set(l.b, [...(portAdj.get(l.b) ?? []), l.a]); }
  const members = new Map<string, string[]>();
  for (const k of portAdj.keys()) { const n = walkNode(k); members.set(n, [...(members.get(n) ?? []), k]); }
  const startNodes = new Set(trace.start.map(walkNode));
  const w = (n: string) => (passPort.has(n) || startNodes.has(n) ? 0 : 1);
  const dist = new Map<string, number>();
  const dq: string[] = [];
  for (const n of startNodes) if (members.has(n)) { dist.set(n, 0); dq.push(n); }
  while (dq.length) {
    const n = dq.shift()!;
    for (const k of members.get(n) ?? []) {
      for (const to of portAdj.get(k) ?? []) {
        const m = walkNode(to);
        const c = dist.get(n)! + w(m);
        if (c >= (dist.get(m) ?? Infinity)) continue;
        dist.set(m, c);
        if (w(m) === 0) dq.unshift(m); else dq.push(m);
      }
    }
  }
  const col = new Map<string, number>();
  for (const k of ports.keys()) col.set(k, Infinity);
  for (const [n, c] of dist) { const dk = deviceKey(n.includes('#') && n.split('#').length === 3 ? n : `${n}#x`); col.set(dk, Math.min(col.get(dk) ?? Infinity, c)); }
  // A pass-through device sits with the device it serves in its rack (nearest column), not where its far side lands.
  const rackOf = (k: string) => k.split('#')[0];
  for (const k of ports.keys()) {
    const [aid, pid] = k.split('#');
    const a = layout.assignments.find((x) => x.id === aid);
    const pl = a && designs(a.designId)?.placements.find((x) => x.id === pid);
    if (!hasPassThrough(pl ? lib.devices.get(pl.deviceId) : undefined)) continue;
    const served = trace.links.flatMap((l) => (deviceKey(l.a) === k ? [l.b] : deviceKey(l.b) === k ? [l.a] : []))
      .map(deviceKey).filter((d) => d !== k && rackOf(d) === rackOf(k) && Number.isFinite(col.get(d)));
    if (served.length) col.set(k, Math.min(...served.map((d) => col.get(d)!)));
  }
  // Devices only reached over an endpoint port (a mgmt switch cabled to servers' BMC ports) sit one column after the
  // device they hang off.
  for (let changed = true; changed;) {
    changed = false;
    for (const l of trace.links) {
      const [x, y] = [deviceKey(l.a), deviceKey(l.b)];
      for (const [u, v] of [[x, y], [y, x]]) {
        if (Number.isFinite(col.get(u)) && !Number.isFinite(col.get(v))) { col.set(v, col.get(u)! + 1); changed = true; }
      }
    }
  }
  for (const [k, c] of col) if (!Number.isFinite(c)) col.set(k, 0);
  const devNodes: TraceNode[] = [];
  for (const [key, set] of ports) {
    const [assignmentId, placementId] = key.split('#');
    const a = layout.assignments.find((x) => x.id === assignmentId);
    const design = a && designs(a.designId);
    const p = design?.placements.find((x) => x.id === placementId);
    const device = p ? lib.devices.get(p.deviceId) : undefined;
    devNodes.push({
      key, assignmentId, placementId, rack: a?.label ?? assignmentId, label: p?.label ?? placementId, sub: device?.name ?? '',
      device, column: col.get(key) ?? 0,
      side: startDevs.has(key) ? 'a' : bSide.has(key) ? 'b' : undefined, ports: set.size, x: 0, y: 0, w: G.nodeW, h: G.nodeH,
    });
  }
  // Blocks (rack per column); merged design groups and collapsed racks are replaced by a summary node.
  const designOf = (rid: string) => layout.assignments.find((a) => a.id === rid)?.designId ?? '';
  const racksPerDesign = new Map<string, Set<string>>();
  for (const n of devNodes) {
    const g = `design:${designOf(n.assignmentId)}@${n.column}`;
    racksPerDesign.set(g, (racksPerDesign.get(g) ?? new Set()).add(n.assignmentId));
  }
  const groupOf = (n: TraceNode) => {
    const g = `design:${designOf(n.assignmentId)}@${n.column}`;
    return racksPerDesign.get(g)!.size > 1 ? g : undefined;
  };
  const rackKey = (n: TraceNode) => `${n.assignmentId}@${n.column}`;
  // A node stands for: its collapsed design group, else its collapsed rack, else itself.
  const blockKey = (n: TraceNode) => { const g = groupOf(n); return g && collapsed.has(g) ? g : collapsed.has(rackKey(n)) ? rackKey(n) : undefined; };
  const nodeOf = new Map<string, TraceNode>();
  const nodes: TraceNode[] = [];
  const blocks = new Map<string, TraceNode[]>();
  for (const n of devNodes) {
    const bk = blockKey(n);
    if (!bk) { nodes.push(n); nodeOf.set(n.key, n); continue; }
    blocks.set(bk, [...(blocks.get(bk) ?? []), n]);
  }
  for (const [bk, devs] of blocks) {
    const f = devs[0];
    const sides = new Set(devs.map((n) => n.side).filter(Boolean));
    const nRacks = new Set(devs.map((n) => n.assignmentId)).size;
    const node: TraceNode = {
      ...f, key: `sum:${bk}`, placementId: '', label: nRacks > 1 ? `${nRacks} racks · ${devs.length} devices` : `${devs.length} devices`,
      sub: summary(devs), device: undefined, devices: devs.length,
      side: sides.has('a') ? 'a' : sides.has('b') ? 'b' : undefined, ports: devs.reduce((n, x) => n + x.ports, 0),
    };
    nodes.push(node);
    for (const n of devs) nodeOf.set(n.key, node);
  }
  const edgeMap = new Map<string, TraceEdge>();
  const cablesOf = new Map<string, Set<string>>();
  for (const e of devEdges.values()) {
    const [x, y] = [nodeOf.get(e.a)!.key, nodeOf.get(e.b)!.key];
    if (x === y) continue;
    const [a, b] = [x, y].sort();
    const ek = `${a}|${b}|${e.mediaId}`;
    const m = lib.cableMedia.get(e.mediaId);
    const t = edgeMap.get(ek) ?? { a, b, mediaId: e.mediaId, media: m?.name ?? e.mediaId.replace(/^via:/, ''), color: m?.color ?? '#64748b', count: 0, cables: 0, kinds: [], index: 0, of: 1 };
    t.count += Math.max(e.ends[0].size, e.ends[1].size);
    const seenCables = cablesOf.get(ek) ?? new Set<string>();
    for (const c of e.cables) seenCables.add(c);
    cablesOf.set(ek, seenCables);
    // Links traced before cables were tracked carry no cable id: count their ports instead, never 0.
    t.cables = seenCables.size || t.count;
    for (const k of e.kinds) if (!t.kinds.includes(k)) t.kinds.push(k);
    edgeMap.set(ek, t);
  }
  // A line with nothing on it is not drawn.
  const edges = [...edgeMap.values()].filter((e) => e.count > 0 && e.cables > 0).sort((x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b) || x.media.localeCompare(y.media));
  // Parallel lines of one box pair: numbered for the offset.
  const perPair = new Map<string, TraceEdge[]>();
  for (const e of edges) perPair.set(`${e.a}|${e.b}`, [...(perPair.get(`${e.a}|${e.b}`) ?? []), e]);
  for (const list of perPair.values()) list.forEach((e, i) => { e.index = i; e.of = list.length; });
  // Rows: per column, top-level blocks (design groups / lone racks) by their first rack label; inside a group, racks by
  // label; devices by label.
  const racks: TraceRackBox[] = [];
  const maxCol = Math.max(0, ...devNodes.map((n) => n.column));
  const byLabel = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
  const W = G.nodeW + 2 * G.rackPad;
  let height = 0;
  for (let c = 0; c <= maxCol; c++) {
    const inCol = devNodes.filter((n) => n.column === c);
    const tops = new Map<string, TraceNode[]>();
    for (const n of inCol) { const t = groupOf(n) ?? rackKey(n); tops.set(t, [...(tops.get(t) ?? []), n]); }
    let y = G.margin;
    /** One rack block: header, then its devices or its summary node. */
    const rackBlock = (rk: string, devs: TraceNode[], level: 0 | 1) => {
      const top = y;
      y += G.rackHead;
      const shown = collapsed.has(rk) ? [nodeOf.get(devs[0].key)!] : devs.sort((p, q) => byLabel(p.label, q.label));
      for (const n of shown) { n.y = y; y += G.nodeH + G.rowGap; }
      y += G.rackPad - G.rowGap;
      // A rack alone names its design ("OVL3 Compute Rack · Row1-09"); inside a design group the group already does.
      const dn = designs(designOf(devs[0].assignmentId))?.name;
      racks.push({ key: rk, assignmentId: devs[0].assignmentId, label: level === 0 && dn ? `${dn} · ${devs[0].rack}` : devs[0].rack, collapsed: collapsed.has(rk), racks: 1, level,
        devices: devs.length, x: 0, y: top, w: W, h: y - top });
    };
    for (const [tk, devs] of [...tops].sort((a, b) => byLabel(a[1][0].rack, b[1][0].rack))) {
      if (!tk.startsWith('design:')) { rackBlock(tk, devs, 0); y += G.rowGap * 2; continue; }
      const design = designs(tk.slice(7, tk.lastIndexOf('@')));
      const nRacks = new Set(devs.map((n) => n.assignmentId)).size;
      const top = y;
      y += G.rackHead;
      if (collapsed.has(tk)) {
        const n = nodeOf.get(devs[0].key)!;
        n.y = y;
        y += G.nodeH + G.rackPad;
      } else {
        const perRack = new Map<string, TraceNode[]>();
        for (const n of devs) perRack.set(n.assignmentId, [...(perRack.get(n.assignmentId) ?? []), n]);
        for (const rd of [...perRack.values()].sort((a, b) => byLabel(a[0].rack, b[0].rack))) { rackBlock(rackKey(rd[0]), rd, 1); y += G.rowGap; }
        y += G.groupPad - G.rowGap;
      }
      racks.push({ key: tk, assignmentId: devs[0].assignmentId, label: `${nRacks}x ${design?.name ?? 'rack'}`, collapsed: collapsed.has(tk), racks: nRacks, level: 0,
        devices: devs.length, x: 0, y: top, w: W + 2 * G.groupPad, h: y - top });
      y += G.rowGap * 2;
    }
    height = Math.max(height, y);
  }
  // Lanes for same-column edges: shortest first, each on the innermost lane free over its span.
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const lanesOf = new Map<number, [number, number][][]>();
  const same = edges.filter((e) => byKey.get(e.a)!.column === byKey.get(e.b)!.column)
    .map((e) => { const [p, q] = [byKey.get(e.a)!, byKey.get(e.b)!]; return { e, c: p.column, lo: Math.min(p.y, q.y), hi: Math.max(p.y, q.y) }; })
    .sort((u, v) => (u.hi - u.lo) - (v.hi - v.lo));
  for (const s of same) {
    const lanes = lanesOf.get(s.c) ?? [];
    let k = lanes.findIndex((l) => l.every(([lo, hi]) => s.hi < lo || s.lo > hi));
    if (k < 0) { k = lanes.length; lanes.push([]); }
    lanes[k].push([s.lo, s.hi]);
    lanesOf.set(s.c, lanes);
    s.e.lane = k;
  }
  // Columns: left bracket room (lanes) + rack block, then the gap to the next column.
  let x = G.margin;
  for (let c = 0; c <= maxCol; c++) {
    x += G.rackPad + 12 + (lanesOf.get(c)?.length ?? 0) * G.lane;
    // Every column reserves the group padding, so devices line up whether or not they sit in a group.
    for (const r of racks) if (r.key.endsWith(`@${c}`)) r.x = r.racks > 1 ? x : x + G.groupPad;
    for (const n of nodes) if (n.column === c) n.x = x + G.groupPad + G.rackPad;
    x += W + 2 * G.groupPad + (c < maxCol ? G.colGap : 0);
  }
  return { nodes, edges, racks, width: x + G.margin, height: height + G.margin };
}

/**
 * A drawing with top-level blocks moved by their offsets (members — inner racks and device boxes — move with their
 * block), and the bounds grown to cover every block. Members are found by geometry in the unmoved drawing.
 */
export function moveBlocks(d: TraceDrawing, offsets: Readonly<Record<string, { dx: number; dy: number }>>): TraceDrawing {
  const tops = d.racks.filter((r) => r.level === 0);
  const inside = (b: { x: number; y: number; w: number; h: number }, t: TraceRackBox) =>
    b.x >= t.x - 0.5 && b.y >= t.y - 0.5 && b.x + b.w <= t.x + t.w + 0.5 && b.y + b.h <= t.y + t.h + 0.5;
  const shift = <T extends { x: number; y: number; w: number; h: number }>(b: T): T => {
    const t = tops.find((x) => inside(b, x));
    const o = t && offsets[t.key];
    return o ? { ...b, x: b.x + o.dx, y: b.y + o.dy } : b;
  };
  const racks = d.racks.map(shift);
  const nodes = d.nodes.map(shift);
  const G = TRACE_GEOM;
  const right = Math.max(d.width, ...racks.map((r) => r.x + r.w + G.margin));
  const bottom = Math.max(d.height, ...racks.map((r) => r.y + r.h + G.margin));
  return { ...d, racks, nodes, width: right, height: bottom };
}

/** Top-level block holding a box (a rack block, a group, or a device / summary node), for dragging. */
export function topBlockOf(d: TraceDrawing, b: { x: number; y: number; w: number; h: number }): TraceRackBox | undefined {
  return d.racks.filter((r) => r.level === 0)
    .find((t) => b.x >= t.x - 0.5 && b.y >= t.y - 0.5 && b.x + b.w <= t.x + t.w + 0.5 && b.y + b.h <= t.y + t.h + 0.5);
}
