import type { Library } from '../library/library';
import type { CableEndpoint, RackDesign } from '../design/types';
import { cableGroupsOnFace, drawOrder, formatPortRef, groupsOnFace } from '../device/ports';
import type { DeviceDefinition, PortGroup } from '../device/types';
import type { DcLayout } from './types';
import type { DesignLookup } from './tiles';
import type { Placement } from '../design/types';
import { placedDevice } from '../design/sizing';
import { unitsIn } from '../units';

/** A port of a device in a rack of the layout. */
export interface TracePort { assignmentId: string; placementId: string; portRef: string }

/** One end of a trace: a rack and the ports picked in it (any devices, any ports); none picked = the whole rack. */
export interface TraceSide { assignmentId: string; ports?: { placementId: string; portRef: string }[] }

/** `cable` = in-rack cable, `cross` = cross-rack cable, `pass` = a pass-through panel's front port to its rear twin. */
export type TraceLinkKind = 'cable' | 'cross' | 'pass';

export interface TraceLink { a: string; b: string; kind: TraceLinkKind; mediaId?: string }

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

export const tracePortKey = (p: TracePort) => `${p.assignmentId}#${p.placementId}#${p.portRef}`;

export function parseTracePortKey(key: string): TracePort {
  const [assignmentId, placementId, ...rest] = key.split('#');
  return { assignmentId, placementId, portRef: rest.join('#') };
}

/** Pass-through panels (fiber housings): front port i continues as rear port i. */
export const isPassThrough = (d: DeviceDefinition | undefined) => d?.category === 'patch-panel';

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
  if (side.ports?.length) return side.ports.map((x) => tracePortKey({ assignmentId: a.id, ...x }));
  const out: string[] = [];
  for (const p of design.placements) {
    const d = lib.devices.get(p.deviceId);
    if (d) for (const portRef of devicePorts(d, false)) out.push(tracePortKey({ assignmentId: a.id, placementId: p.id, portRef }));
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
  const cable = (aid: string, from: CableEndpoint[], to: CableEndpoint[], mediaId: string, kind: TraceLinkKind, bid = aid) => {
    const m = lib.cableMedia.get(mediaId);
    for (const [i, j] of cablePairs(from.length, to.length, m?.mapping === 'shuffle')) {
      const x = from[i];
      const y = to[j];
      if (!x?.portRef || !y?.portRef) continue;
      add({ kind, mediaId, a: tracePortKey({ assignmentId: aid, placementId: x.placementId, portRef: x.portRef }),
        b: tracePortKey({ assignmentId: bid, placementId: y.placementId, portRef: y.portRef }) });
    }
  };
  for (const a of layout.assignments) {
    const design: RackDesign | undefined = designs(a.designId);
    if (!design) continue;
    for (const run of design.cables) cable(a.id, run.from, run.to, run.mediaId, 'cable');
    for (const p of design.placements) {
      const d = lib.devices.get(p.deviceId);
      if (!isPassThrough(d)) continue;
      const refs = (face: 'front' | 'rear') => groupsOnFace(d!, face)
        .flatMap((g) => Array.from({ length: g.count }, (_, i) => formatPortRef({ groupId: g.id, index: i + 1 })));
      const front = refs('front');
      const rear = refs('rear');
      for (let i = 0; i < Math.min(front.length, rear.length); i++) {
        add({ kind: 'pass', a: tracePortKey({ assignmentId: a.id, placementId: p.id, portRef: front[i] }),
          b: tracePortKey({ assignmentId: a.id, placementId: p.id, portRef: rear[i] }) });
      }
    }
  }
  for (const c of layout.crossCables ?? []) {
    const ia = c.from[0]?.assignmentId;
    const ib = c.to[0]?.assignmentId;
    if (ia && ib) cable(ia, c.from, c.to, c.mediaId, 'cross', ib);
  }
  return adj;
}

/** Ports reached from `start` (breadth first) and the links walked on the way. */
function expand(adj: Adj, start: string[]): { ports: Set<string>; links: TraceLink[] } {
  const ports = new Set(start);
  const links = new Set<TraceLink>();
  const queue = [...start];
  while (queue.length) {
    const u = queue.shift()!;
    for (const { to, link } of adj.get(u) ?? []) {
      links.add(link);
      // A port already in the set is not walked again; a new one joins the set and is expanded from.
      if (ports.has(to)) continue;
      ports.add(to);
      queue.push(to);
    }
  }
  return { ports, links: [...links] };
}

/**
 * Traces from side A outward over cables, cross-rack cables and pass-through panels (port to port; traffic does not
 * cross a switch). Without B: everything connected to A. With B: the links on paths from A to B — the part reached
 * from both sides, with dead-end branches (ports with one link that are on neither side) pruned away.
 */
export function traceTopology(lib: Library, designs: DesignLookup, layout: DcLayout, a: TraceSide, b?: TraceSide): { start: string[]; links: TraceLink[] } {
  const adj = traceGraph(lib, designs, layout);
  const start = sidePorts(lib, designs, layout, a);
  const fromA = expand(adj, start);
  if (!b) return { start, links: fromA.links };
  const end = sidePorts(lib, designs, layout, b);
  const fromB = expand(adj, end);
  let links = fromA.links.filter((l) => fromB.ports.has(l.a) && fromB.ports.has(l.b));
  const keep = new Set([...start, ...end]);
  for (;;) {
    const degree = new Map<string, number>();
    for (const l of links) for (const k of [l.a, l.b]) degree.set(k, (degree.get(k) ?? 0) + 1);
    const next = links.filter((l) => [l.a, l.b].every((k) => keep.has(k) || degree.get(k)! > 1));
    if (next.length === links.length) break;
    links = next;
  }
  return { start, links };
}

// ------------------------------------------------------------------------------------------------ drawing layout

export interface TraceNode {
  /** `assignmentId#placementId`. */
  key: string;
  assignmentId: string;
  placementId: string;
  rack: string;
  label: string;
  device?: DeviceDefinition;
  /** Hops (device to device) from side A. */
  column: number;
  side?: 'a' | 'b';
  ports: number;
  x: number; y: number; w: number; h: number;
}

/** `count` = ports joined: the larger of the two ends' distinct port counts (a shuffle's all-to-all pairs count once). */
export interface TraceEdge { a: string; b: string; count: number; media: string[]; kinds: TraceLinkKind[] }

export interface TraceRackBox { assignmentId: string; label: string; x: number; y: number; w: number; h: number }

export interface TraceDrawing { nodes: TraceNode[]; edges: TraceEdge[]; racks: TraceRackBox[]; width: number; height: number }

export const TRACE_GEOM = { nodeW: 200, nodeH: 44, colGap: 140, rowGap: 14, rackPad: 10, rackHead: 22, margin: 24, bracket: 90 } as const;

const deviceKey = (portKey: string) => { const p = parseTracePortKey(portKey); return `${p.assignmentId}#${p.placementId}`; };

/**
 * Device-level picture of a trace: one box per device that has a traced port, in columns by hops from side A,
 * devices of one rack stacked in a rack box; one edge per device pair with its link count and cable types.
 */
export function traceDrawing(lib: Library, designs: DesignLookup, layout: DcLayout, trace: TopoTrace): TraceDrawing {
  const G = TRACE_GEOM;
  const ports = new Map<string, Set<string>>();
  const touch = (k: string) => { const d = deviceKey(k); const s = ports.get(d) ?? new Set(); s.add(k); ports.set(d, s); };
  for (const l of trace.links) { touch(l.a); touch(l.b); }
  const startDevs = new Set(trace.start.map(deviceKey).filter((d) => ports.has(d)));
  if (!ports.size) for (const k of trace.start) { touch(k); startDevs.add(deviceKey(k)); }
  const bSide = trace.b ? new Set(sidePorts(lib, designs, layout, trace.b).map(deviceKey)) : new Set<string>();
  // Edges between devices (links inside one device, e.g. pass-through, are not drawn).
  const edges = new Map<string, TraceEdge>();
  const endPorts = new Map<string, [Set<string>, Set<string>]>();
  for (const l of trace.links) {
    const [x, y] = [deviceKey(l.a), deviceKey(l.b)];
    if (x === y) continue;
    const [a, b] = [x, y].sort();
    const e = edges.get(`${a}|${b}`) ?? { a, b, count: 0, media: [], kinds: [] };
    const ends = endPorts.get(`${a}|${b}`) ?? [new Set<string>(), new Set<string>()];
    const [pa, pb] = x === a ? [l.a, l.b] : [l.b, l.a];
    ends[0].add(pa); ends[1].add(pb);
    endPorts.set(`${a}|${b}`, ends);
    e.count = Math.max(ends[0].size, ends[1].size);
    const name = l.mediaId ? lib.cableMedia.get(l.mediaId)?.name ?? l.mediaId : '';
    if (name && !e.media.includes(name)) e.media.push(name);
    if (!e.kinds.includes(l.kind)) e.kinds.push(l.kind);
    edges.set(`${a}|${b}`, e);
  }
  // Columns: hops from the A devices.
  const col = new Map<string, number>([...startDevs].map((d) => [d, 0]));
  const queue = [...startDevs];
  while (queue.length) {
    const u = queue.shift()!;
    for (const e of edges.values()) {
      const v = e.a === u ? e.b : e.b === u ? e.a : undefined;
      if (v && !col.has(v)) { col.set(v, col.get(u)! + 1); queue.push(v); }
    }
  }
  const nodes: TraceNode[] = [];
  for (const [key, set] of ports) {
    const [assignmentId, placementId] = key.split('#');
    const a = layout.assignments.find((x) => x.id === assignmentId);
    const design = a && designs(a.designId);
    const p = design?.placements.find((x) => x.id === placementId);
    nodes.push({
      key, assignmentId, placementId, rack: a?.label ?? assignmentId, label: p?.label ?? placementId,
      device: p ? lib.devices.get(p.deviceId) : undefined, column: col.get(key) ?? 0,
      side: startDevs.has(key) ? 'a' : bSide.has(key) ? 'b' : undefined, ports: set.size, x: 0, y: 0, w: G.nodeW, h: G.nodeH,
    });
  }
  // Place: per column, racks in label order, devices in rack order; each rack in a column gets a box.
  const racks: TraceRackBox[] = [];
  const maxCol = Math.max(0, ...nodes.map((n) => n.column));
  let height = 0;
  for (let c = 0; c <= maxCol; c++) {
    const inCol = nodes.filter((n) => n.column === c);
    const rackIds = [...new Set(inCol.map((n) => n.assignmentId))]
      .sort((x, y) => (inCol.find((n) => n.assignmentId === x)!.rack).localeCompare(inCol.find((n) => n.assignmentId === y)!.rack, undefined, { numeric: true }));
    const x = G.margin + G.bracket + c * (G.nodeW + 2 * G.rackPad + G.colGap);
    let y = G.margin;
    for (const rid of rackIds) {
      const devs = inCol.filter((n) => n.assignmentId === rid).sort((p, q) => p.label.localeCompare(q.label, undefined, { numeric: true }));
      const top = y;
      y += G.rackHead;
      for (const n of devs) { n.x = x + G.rackPad; n.y = y; y += G.nodeH + G.rowGap; }
      y += G.rackPad - G.rowGap;
      racks.push({ assignmentId: rid, label: devs[0].rack, x, y: top, w: G.nodeW + 2 * G.rackPad, h: y - top });
      y += G.rowGap * 2;
    }
    height = Math.max(height, y);
  }
  const width = G.margin * 2 + G.bracket + (maxCol + 1) * (G.nodeW + 2 * G.rackPad) + maxCol * G.colGap;
  return { nodes, edges: [...edges.values()], racks, width, height: height + G.margin };
}
