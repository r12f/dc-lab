import type { Library } from '../../domain/library/library';
import type { CableRoute, CableRun, Placement, RackDesign } from '../../domain/design/types';
import type { RackTemplate } from '../../domain/rack/types';
import type { RackGeometry } from '../../drawing/rack-geometry';
import { placementRect } from './placed-device';
import { sizedDevice } from '../../domain/design/sizing';

/** Lane pitch in the cable channel: at most LANE_MAX, at least LANE_MIN (the channel widens to keep it). */
export const LANE_MAX = 6;
export const LANE_MIN = 2.5;

/**
 * A link on the elevation: every cable run between the same devices, drawn as one line. A plain cable joins one
 * device pair; a breakout (e.g. a shuffle to 4 switches) joins all the devices it touches.
 */
export interface CableLink {
  /** Sorted placement ids joined, `|`-separated. */
  key: string;
  placementIds: string[];
  /** Side channel: the one most of its runs use. */
  route: CableRoute;
  runs: CableRun[];
}

/** Groups the design's cable runs into links, one per set of devices joined. */
export function cableLinks(design: RackDesign): CableLink[] {
  const byKey = new Map<string, CableLink>();
  for (const run of design.cables) {
    const ids = [...new Set([...run.from, ...run.to].map((e) => e.placementId))].sort();
    const key = ids.join('|');
    let link = byKey.get(key);
    if (!link) { link = { key, placementIds: ids, route: run.route, runs: [] }; byKey.set(key, link); }
    link.runs.push(run);
  }
  for (const link of byKey.values()) {
    const left = link.runs.filter((r) => r.route === 'left').length;
    link.route = left * 2 >= link.runs.length ? 'left' : 'right';
  }
  return [...byKey.values()];
}

/** Channel width that keeps every lane at least LANE_MIN apart: the larger side's link count decides. */
export function cableGutter(design: RackDesign, base: number): number {
  const links = cableLinks(design);
  const n = Math.max(...(['left', 'right'] as const).map((s) => links.filter((l) => l.route === s).length), 0);
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
  const r = placementRect(p, sizedDevice(raw, rack, p.units), rack, geo);
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
 * Polylines for every link: one stub per device into the link's lane in the cable channel outside the rails
 * (unit numbers stay visible), and a spine joining them. Per side, lanes are assigned by vertical span (longest
 * link outermost) so nested links never cross.
 */
export function routeCables(lib: Library, design: RackDesign, rack: RackTemplate, geo: RackGeometry): RoutedLink[] {
  const find = (id: string) => design.placements.find((p) => p.id === id);
  const placed = cableLinks(design).map((link) => {
    const ends = link.placementIds
      .map((id) => { const p = find(id); return p && exitPoint(lib, rack, geo, p, link.route); })
      .filter((e): e is [number, number] => !!e);
    if (ends.length < 1) return undefined;
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
