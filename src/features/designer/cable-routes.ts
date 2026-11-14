import type { Library } from '../../domain/library/library';
import type { CableRoute, CableRun, Placement, RackDesign } from '../../domain/design/types';
import type { RackTemplate } from '../../domain/rack/types';
import type { RackGeometry } from '../../drawing/rack-geometry';
import { placementRect } from './placed-device';

export interface RoutedCable {
  run: CableRun;
  /** One polyline per B end; all share the A end and the lane. */
  paths: [number, number][][];
}

/** Where a cable leaves a device toward the channel on `route`: the device edge on that side, at its centre height. */
function exitPoint(lib: Library, rack: RackTemplate, geo: RackGeometry, p: Placement, route: CableRoute): [number, number] | undefined {
  const d = lib.devices.get(p.deviceId);
  if (!d) return undefined;
  const r = placementRect(p, d, rack, geo);
  if (r.w === 0) return undefined;
  const y = r.y + r.h / 2;
  if (p.mount.kind === 'side') {
    // Side devices exit toward the rack body.
    const leftOfBody = r.x + r.w / 2 < geo.originX;
    return [leftOfBody ? r.x + r.w : r.x, y];
  }
  return [route === 'left' ? r.x : r.x + r.w, y];
}

/**
 * Polylines for every run: start -> lane in the chosen side's rail channel -> end.
 * Per side, lanes are assigned by vertical span (longest run outermost) so nested runs never cross.
 */
export function routeCables(lib: Library, design: RackDesign, rack: RackTemplate, geo: RackGeometry): RoutedCable[] {
  const find = (id: string) => design.placements.find((p) => p.id === id);
  const ends = design.cables.map((run) => {
    const a = find(run.from.placementId);
    const s = a && exitPoint(lib, rack, geo, a, run.route);
    const es = run.to.map((t) => { const b = find(t.placementId); return b && exitPoint(lib, rack, geo, b, run.route); })
      .filter((e): e is [number, number] => !!e);
    return s && es.length ? { run, s, es, span: Math.max(...es.map((e) => Math.abs(s[1] - e[1]))) } : undefined;
  }).filter((x): x is NonNullable<typeof x> => !!x);

  const out: RoutedCable[] = [];
  for (const side of ['left', 'right'] as const) {
    const runs = ends.filter((x) => x.run.route === side).sort((a, b) => a.span - b.span); // shortest = innermost
    const step = Math.min(6, (geo.railW - 8) / Math.max(1, runs.length));
    const bodyEdge = side === 'left' ? geo.originX + geo.railW : geo.originX + geo.railW + geo.bodyW;
    runs.forEach(({ run, s, es }, i) => {
      const off = 4 + i * step;
      const lane = side === 'left' ? bodyEdge - off : bodyEdge + off;
      out.push({ run, paths: es.map((e) => [s, [lane, s[1]], [lane, e[1]], e]) });
    });
  }
  return out;
}
