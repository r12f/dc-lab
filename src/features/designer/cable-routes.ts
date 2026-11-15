import type { Library } from '../../domain/library/library';
import type { CableEndpoint, CableRoute, CableRun, Placement, RackDesign } from '../../domain/design/types';
import type { PortFace } from '../../domain/device/types';
import { findGroup, parsePortRef } from '../../domain/device/ports';
import { REAR_ONLY_KINDS } from '../../domain/rack/side-elements';
import type { RackTemplate } from '../../domain/rack/types';
import type { RackGeometry } from '../../drawing/rack-geometry';
import { placementRect } from './placed-device';
import { sizedDevice } from '../../domain/design/sizing';

/** Lane pitch in the cable channel: at most LANE_MAX, at least LANE_MIN (the channel widens to keep it). */
export const LANE_MAX = 6;
export const LANE_MIN = 2.5;

/**
 * A link on the elevation: every cable run joining the same devices on the same side channel, drawn as one line.
 * A plain cable joins one device pair; a breakout (e.g. a shuffle to 4 switches) joins all the devices it touches.
 * Runs on the left and on the right channel are separate links (they are separate bundles).
 */
export interface CableLink {
  /** Sorted placement ids joined, `|`-separated, then the route and the faces. */
  key: string;
  placementIds: string[];
  route: CableRoute;
  /** Rack faces its ends are on; drawn on those faces only (empty = unknown, drawn on both). */
  faces: PortFace[];
  runs: CableRun[];
}

/**
 * Rack face a cable end is on: its port group's face, flipped for a rear-mounted device; a device in a rear-only
 * side element (PDU bay) is on the rear. Undefined when unknown (no port picked) or for other side elements
 * (reachable from both faces).
 */
export function endpointFace(lib: Library, design: RackDesign, ep: CableEndpoint): PortFace | undefined {
  const p = design.placements.find((x) => x.id === ep.placementId);
  if (!p) return undefined;
  if (p.mount.kind === 'side') {
    const id = p.mount.elementId;
    const el = lib.racks.get(design.templateId)?.sideElements.find((e) => e.id === id);
    return el && REAR_ONLY_KINDS.has(el.kind) ? 'rear' : undefined;
  }
  const d = lib.devices.get(p.deviceId);
  const ref = parsePortRef(ep.portRef);
  const g = d && ref && findGroup(d, ref.groupId);
  if (!g) return undefined;
  return p.mount.face === 'rear' ? (g.face === 'front' ? 'rear' : 'front') : g.face;
}

/** Groups the design's cable runs into links: one per set of devices joined, side channel and faces. */
export function cableLinks(lib: Library, design: RackDesign): CableLink[] {
  const byKey = new Map<string, CableLink>();
  for (const run of design.cables) {
    const ids = [...new Set([...run.from, ...run.to].map((e) => e.placementId))].sort();
    const faces = [...new Set([...run.from, ...run.to].map((e) => endpointFace(lib, design, e)).filter((f): f is PortFace => !!f))].sort();
    const key = `${ids.join('|')}#${run.route}#${faces.join('+')}`;
    let link = byKey.get(key);
    if (!link) { link = { key, placementIds: ids, route: run.route, faces, runs: [] }; byKey.set(key, link); }
    link.runs.push(run);
  }
  return [...byKey.values()];
}

/** True when the link is drawn on rack face `face`: one of its ends is on it (or its faces are unknown). */
export const linkOnFace = (link: CableLink, face: PortFace) => link.faces.length === 0 || link.faces.includes(face);

/** Channel width that keeps every lane at least LANE_MIN apart: the busiest side channel of either face decides. */
export function cableGutter(lib: Library, design: RackDesign, base: number): number {
  const links = cableLinks(lib, design);
  const n = Math.max(0, ...(['front', 'rear'] as const).flatMap((f) =>
    (['left', 'right'] as const).map((s) => links.filter((l) => l.route === s && linkOnFace(l, f)).length)));
  return Math.max(base, 10 + n * LANE_MIN);
}

export interface RoutedLink {
  link: CableLink;
  /** Spine in the lane first, then one stub per device. */
  paths: [number, number][][];
}

/**
 * Where a cable leaves a device toward the channel on `route`: the device edge on that side, near its top
 * (unit numbers sit at the bottom of each unit, so the stub across the rail does not cover them).
 */
function exitPoint(lib: Library, rack: RackTemplate, geo: RackGeometry, p: Placement, route: CableRoute): [number, number] | undefined {
  const raw = lib.devices.get(p.deviceId);
  if (!raw) return undefined;
  const r = placementRect(p, sizedDevice(raw, rack, p.repeat), rack, geo);
  if (r.w === 0) return undefined;
  const y = r.y + Math.min(4, r.h / 2);
  if (p.mount.kind === 'side') {
    // Side devices exit toward the rack body.
    const leftOfBody = r.x + r.w / 2 < geo.originX;
    return [leftOfBody ? r.x + r.w : r.x, y];
  }
  return [route === 'left' ? r.x : r.x + r.w, y];
}

/**
 * Polylines for every link drawn on `face` (all when omitted): any end on that face puts the link there. A device
 * not drawn on the face (e.g. a PDU in a rear-only bay seen from the front) gets no stub. One stub per device into the link's lane in the cable channel outside the rails
 * (unit numbers stay visible), and a spine joining them. Per side, lanes are assigned by vertical span (longest
 * link outermost) so nested links never cross.
 */
export function routeCables(lib: Library, design: RackDesign, rack: RackTemplate, geo: RackGeometry, face?: PortFace): RoutedLink[] {
  const find = (id: string) => design.placements.find((p) => p.id === id);
  const placed = cableLinks(lib, design).filter((l) => !face || linkOnFace(l, face)).map((link) => {
    const ends = link.placementIds
      .map((id) => { const p = find(id); return p && exitPoint(lib, rack, geo, p, link.route); })
      .filter((e): e is [number, number] => !!e);
    // A device not drawn on this face (e.g. a PDU in a rear-only bay) leaves no end; a link needs two.
    if (ends.length < 2) return undefined;
    const ys = ends.map((p) => p[1]);
    return { link, ends, span: Math.max(...ys) - Math.min(...ys) };
  }).filter((x): x is NonNullable<typeof x> => !!x);

  const out: RoutedLink[] = [];
  for (const side of ['left', 'right'] as const) {
    const links = placed.filter((x) => x.link.route === side).sort((a, b) => a.span - b.span); // shortest = innermost
    const room = Math.max(6, geo.gutter - 6);
    const step = Math.min(LANE_MAX, room / Math.max(1, links.length));
    // Outer edge of the frame (outside the rails and their unit numbers).
    const frameEdge = side === 'left' ? geo.originX : geo.originX + geo.railW * 2 + geo.bodyW;
    links.forEach(({ link, ends }, i) => {
      const off = 4 + i * step;
      const lane = side === 'left' ? frameEdge - off : frameEdge + off;
      const ys = ends.map((p) => p[1]);
      const spine: [number, number][] = [[lane, Math.min(...ys)], [lane, Math.max(...ys)]];
      out.push({ link, paths: [spine, ...ends.map((p): [number, number][] => [p, [lane, p[1]]])] });
    });
  }
  return out;
}
