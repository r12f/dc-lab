import type { Library } from '../library/library';
import type { CableEndpoint, Placement, RackDesign } from '../design/types';
import type { CableMedia } from '../optics/types';
import { endFits, endpointKey, endpointLeg } from '../design/cable-assign';
import { placedDevice } from '../design/sizing';
import { unitsIn } from '../units';
import { cableGroupsOnFace, drawOrder, parsePortRef } from '../device/ports';
import type { PortGroup } from '../device/types';
import type { CrossRackCable, CrossRackEnd, DcLayout, RackAssignment } from './types';
import { computeFloorPlan, tileRect, trayRect, type FloorPlan } from './floor-plan';
import { tileWidthOf, type DesignLookup } from './tiles';

/** Key of a cross-rack end, unique in the layout. */
export const crossEndKey = (e: CrossRackEnd) => `${e.assignmentId}#${endpointKey(e)}`;

/** Ends of every cross-rack cable in the layout, by key -> cable id. */
export function usedCrossEnds(layout: DcLayout): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of layout.crossCables ?? []) for (const e of [...c.from, ...c.to]) m.set(crossEndKey(e), c.id);
  return m;
}

export interface CrossPortGroup {
  group: PortGroup;
  /** Port index -> its cross-rack connectors (1-based leg numbers; undefined = port-level). */
  ports: Map<number, (number | undefined)[]>;
}

export interface CrossFace {
  face: 'front' | 'rear';
  /** Every cable port group of the face, in drawing order (left to right), so the face reads like the faceplate. */
  groups: CrossPortGroup[];
}

export interface CrossDevice {
  placement: Placement;
  /** Faces with at least one cross-rack connector. */
  faces: CrossFace[];
}

/**
 * Cross-rack connectors of a design, laid out like its cabling view: rack devices top to bottom, then side
 * devices; each device's port groups in drawing order (mirrored faces right to left). Devices without a
 * cross-rack connector are left out.
 */
export function crossRackLayout(lib: Library, design: RackDesign): CrossDevice[] {
  const marks = design.crossRack ?? [];
  if (!marks.length) return [];
  const rack = lib.racks.get(design.templateId);
  const top = (p: Placement) => {
    if (p.mount.kind !== 'rack') return -Infinity;
    const d = placedDevice(lib, design, p);
    return p.mount.position + (d && rack ? Math.max(1, unitsIn(d.height, rack.unitSystem)) : 1) - 1;
  };
  const out: CrossDevice[] = [];
  for (const p of [...design.placements].sort((a, b) => top(b) - top(a))) {
    const mine = marks.filter((m) => m.placementId === p.id);
    const device = mine.length ? placedDevice(lib, design, p) : undefined;
    if (!device) continue;
    const faces: CrossFace[] = [];
    for (const face of ['front', 'rear'] as const) {
      const groups: CrossPortGroup[] = [];
      for (const g of drawOrder(cableGroupsOnFace(device, face))) {
        const ports = new Map<number, (number | undefined)[]>();
        for (const m of mine) {
          const r = parsePortRef(m.portRef);
          if (r?.groupId !== g.id) continue;
          const list = ports.get(r.index) ?? [];
          list.push(m.connector);
          ports.set(r.index, list.sort((a, b) => (a ?? 0) - (b ?? 0)));
        }
        groups.push({ group: g, ports });
      }
      if (groups.some((g) => g.ports.size)) faces.push({ face, groups });
    }
    if (faces.length) out.push({ placement: p, faces });
  }
  return out;
}

const toEndpoint = (e: CrossRackEnd): CableEndpoint => ({ placementId: e.placementId, portRef: e.portRef, connector: e.connector });

export interface CrossPlan {
  cables: Omit<CrossRackCable, 'id'>[];
  error?: string;
}

/**
 * Cables over the selected cross-rack connectors: A ends taken the cable's A count at a time, B ends its B count
 * at a time, paired in order; tried reversed when the cable's A end fits the B side.
 */
export function planCrossCables(
  lib: Library, designs: DesignLookup, layout: DcLayout, a: CrossRackEnd[], b: CrossRackEnd[], mediaId: string,
): CrossPlan {
  const media = lib.cableMedia.get(mediaId);
  if (!media) return { cables: [], error: 'Pick a cable' };
  if (!a.length || !b.length) return { cables: [], error: 'Select connectors on both sides' };
  const used = usedCrossEnds(layout);
  const taken = [...a, ...b].find((e) => used.has(crossEndKey(e)));
  if (taken) return { cables: [], error: `${taken.portRef}${taken.connector ? `.${taken.connector}` : ''} already has a cable` };
  const fit = (side: 'a' | 'b', ends: CrossRackEnd[]) => ends.every((e) => endFitsCross(lib, designs, layout, media, side, e));
  const build = (x: CrossRackEnd[], y: CrossRackEnd[]): CrossPlan => {
    const na = media.ends.a.count;
    const nb = media.ends.b.count;
    if (x.length % na) return { cables: [], error: `${x.length} connectors is not a multiple of ${na} (cable A end)` };
    if (y.length % nb) return { cables: [], error: `${y.length} connectors is not a multiple of ${nb} (cable B end)` };
    if (x.length / na !== y.length / nb) return { cables: [], error: `${x.length / na} cable(s) on one side but ${y.length / nb} on the other` };
    const cables = Array.from({ length: x.length / na }, (_, i) => ({
      mediaId, from: x.slice(i * na, i * na + na), to: y.slice(i * nb, i * nb + nb),
    }));
    return { cables };
  };
  if (fit('a', a) && fit('b', b)) return build(a, b);
  if (fit('a', b) && fit('b', a)) return build(b, a);
  return { cables: [], error: `${media.name} does not fit the selected connectors` };
}

function endFitsCross(lib: Library, designs: DesignLookup, layout: DcLayout, media: CableMedia, side: 'a' | 'b', e: CrossRackEnd) {
  const a = layout.assignments.find((x) => x.id === e.assignmentId);
  const design = a && designs(a.designId);
  return !!design && endFits(media, side, endpointLeg(lib, design, toEndpoint(e)));
}

/** Cables that fit the selection; with one side selected, cables with an end that fits it. */
export function applicableCrossCables(lib: Library, designs: DesignLookup, layout: DcLayout, a: CrossRackEnd[], b: CrossRackEnd[]): CableMedia[] {
  const all = lib.cableMedia.items();
  if (!a.length && !b.length) return all;
  if (!a.length || !b.length) {
    const ends = [...a, ...b];
    return all.filter((m) => (['a', 'b'] as const).some((s) => ends.every((e) => endFitsCross(lib, designs, layout, m, s, e))));
  }
  return all.filter((m) => !planCrossCables(lib, designs, layout, a, b, m.id).error);
}

/** Fibers of one cable: its stated fiber count, else connectors × fibers per connector of its A end. */
export function cableFibers(media: CableMedia | undefined): number {
  if (!media) return 0;
  return media.fiberCount ?? media.ends.a.count * (media.ends.a.fibers ?? 0);
}

// ------------------------------------------------------------------------------------------------ routing

export interface Pt { x: number; y: number }

/** Centre of a rack on the plan (mm). */
export function rackCenter(lib: Library, designs: DesignLookup, layout: DcLayout, plan: FloorPlan, a: RackAssignment): Pt | undefined {
  const row = layout.rows.find((r) => r.id === a.rowId);
  const rect = plan.rects.get(a.rowId);
  if (!row || !rect) return undefined;
  const r = tileRect(rect, row, a.startTile, tileWidthOf(lib, designs(a.designId)));
  return { x: r.x + r.widthMm / 2, y: r.y + r.depthMm / 2 };
}

interface Seg { a: Pt; b: Pt }

/** Centre line of each data tray (power trays carry no data cables). */
function trayLines(layout: DcLayout, plan: FloorPlan): Seg[] {
  const out: Seg[] = [];
  for (const t of layout.trays) {
    if (t.kind !== 'data') continue;
    const r = trayRect(plan, t);
    if (!r) continue;
    if (r.widthMm >= r.depthMm) out.push({ a: { x: r.x, y: r.y + r.depthMm / 2 }, b: { x: r.x + r.widthMm, y: r.y + r.depthMm / 2 } });
    else out.push({ a: { x: r.x + r.widthMm / 2, y: r.y }, b: { x: r.x + r.widthMm / 2, y: r.y + r.depthMm } });
  }
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(Math.min(lo, hi), Math.min(Math.max(lo, hi), v));
const dist = (p: Pt, q: Pt) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y);

/** Nearest point of a horizontal / vertical segment to `p`. */
function project(s: Seg, p: Pt): Pt {
  return { x: clamp(p.x, s.a.x, s.b.x), y: clamp(p.y, s.a.y, s.b.y) };
}

/** Crossing point of two segments (one horizontal, one vertical), or undefined. */
function cross(s: Seg, t: Seg): Pt | undefined {
  const sh = s.a.y === s.b.y;
  const th = t.a.y === t.b.y;
  if (sh === th) return undefined;
  const [h, v] = sh ? [s, t] : [t, s];
  const x = v.a.x;
  const y = h.a.y;
  const inH = x >= Math.min(h.a.x, h.b.x) - 1e-6 && x <= Math.max(h.a.x, h.b.x) + 1e-6;
  const inV = y >= Math.min(v.a.y, v.b.y) - 1e-6 && y <= Math.max(v.a.y, v.b.y) + 1e-6;
  return inH && inV ? { x, y } : undefined;
}

/**
 * Path of a cable between two racks: from rack A straight to the nearest point of the nearest data tray, along trays
 * (switching trays only where they cross) to the tray point nearest rack B, then to rack B. Shortest by length
 * (Dijkstra over tray crossings and the two entry points). Straight line when the racks share no tray network.
 */
export function crossRoute(layout: DcLayout, plan: FloorPlan, from: Pt, to: Pt): Pt[] {
  const lines = trayLines(layout, plan);
  if (!lines.length) return [from, to];
  const near = (p: Pt) => lines.map((s, i) => ({ i, q: project(s, p) })).sort((u, v) => dist(u.q, p) - dist(v.q, p))[0];
  const ea = near(from);
  const eb = near(to);
  // Nodes per tray: crossings with other trays plus the entry points on it.
  const nodes: Pt[] = [];
  const onLine: number[][] = lines.map(() => []);
  const add = (p: Pt, ...ls: number[]) => { const id = nodes.length; nodes.push(p); for (const l of ls) onLine[l].push(id); return id; };
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const c = cross(lines[i], lines[j]);
      if (c) add(c, i, j);
    }
  }
  const na = add(ea.q, ea.i);
  const nb = add(eb.q, eb.i);
  const adj: { to: number; w: number }[][] = nodes.map(() => []);
  onLine.forEach((ids, l) => {
    const s = lines[l];
    const along = (p: Pt) => (s.a.y === s.b.y ? p.x : p.y);
    const sorted = [...ids].sort((u, v) => along(nodes[u]) - along(nodes[v]));
    for (let k = 1; k < sorted.length; k++) {
      const u = sorted[k - 1];
      const v = sorted[k];
      const w = dist(nodes[u], nodes[v]);
      adj[u].push({ to: v, w });
      adj[v].push({ to: u, w });
    }
  });
  const d = nodes.map(() => Infinity);
  const prev = nodes.map(() => -1);
  const done = nodes.map(() => false);
  d[na] = 0;
  for (;;) {
    let u = -1;
    for (let k = 0; k < nodes.length; k++) if (!done[k] && d[k] < Infinity && (u < 0 || d[k] < d[u])) u = k;
    if (u < 0 || u === nb) break;
    done[u] = true;
    for (const e of adj[u]) if (d[u] + e.w < d[e.to]) { d[e.to] = d[u] + e.w; prev[e.to] = u; }
  }
  if (d[nb] === Infinity) return [from, to];
  const path: Pt[] = [];
  for (let k = nb; k >= 0; k = prev[k]) path.unshift(nodes[k]);
  // Rack to tray: one leg along x or y (an L when the tray is diagonal from the rack centre).
  const leg = (r: Pt, q: Pt): Pt[] => (r.x === q.x || r.y === q.y ? [] : [{ x: q.x, y: r.y }]);
  return [from, ...leg(from, path[0]), ...path, ...leg(to, path[path.length - 1]).reverse(), to];
}

export interface CrossTrace {
  /** Sorted pair of assignment ids. */
  key: string;
  a: RackAssignment;
  b: RackAssignment;
  points: Pt[];
  cables: number;
  fibers: number;
}

/** One trace per rack pair with cross-rack cables between them (all cables of the pair aggregated). */
export function crossTraces(lib: Library, designs: DesignLookup, layout: DcLayout, plan = computeFloorPlan(layout)): CrossTrace[] {
  const byPair = new Map<string, CrossTrace>();
  // Cables whose ends lost their cross-rack mark (or rack) are not drawn.
  for (const c of pruneCrossCables(designs, layout).crossCables ?? []) {
    const ia = c.from[0]?.assignmentId;
    const ib = c.to[0]?.assignmentId;
    if (!ia || !ib || ia === ib) continue;
    const [x, y] = [ia, ib].sort();
    const key = `${x}|${y}`;
    let t = byPair.get(key);
    if (!t) {
      const a = layout.assignments.find((r) => r.id === x);
      const b = layout.assignments.find((r) => r.id === y);
      const pa = a && rackCenter(lib, designs, layout, plan, a);
      const pb = b && rackCenter(lib, designs, layout, plan, b);
      if (!a || !b || !pa || !pb) continue;
      t = { key, a, b, points: crossRoute(layout, plan, pa, pb), cables: 0, fibers: 0 };
      byPair.set(key, t);
    }
    t.cables += 1;
    t.fibers += cableFibers(lib.cableMedia.get(c.mediaId));
  }
  return [...byPair.values()];
}

/** Drops cross-rack cables whose racks are gone or whose ends are no longer marked cross-rack. */
export function pruneCrossCables(designs: DesignLookup, layout: DcLayout): DcLayout {
  if (!layout.crossCables?.length) return layout;
  const ok = (e: CrossRackEnd) => {
    const a = layout.assignments.find((x) => x.id === e.assignmentId);
    const d = a && designs(a.designId);
    return !!d && (d.crossRack ?? []).some((m) => endpointKey(m) === endpointKey(e));
  };
  const kept = layout.crossCables.filter((c) => [...c.from, ...c.to].every(ok));
  return kept.length === layout.crossCables.length ? layout : { ...layout, crossCables: kept };
}
