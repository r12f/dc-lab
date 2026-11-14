import type { Library } from '../../domain/library/library';
import type { CableRoute, CableRun, Placement, RackDesign } from '../../domain/design/types';
import type { RackTemplate } from '../../domain/rack/types';
import type { RackGeometry } from '../../drawing/rack-geometry';
import { placementRect } from './placed-device';
import { sizedDevice } from '../../domain/design/sizing';

export interface RoutedCable {
  run: CableRun;
  /** Spine in the lane first, then one stub per endpoint (A ends, then B ends). */
  paths: [number, number][][];
  /** Number of A-end stubs (paths[1..starts]). */
  starts: number;
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
 * Polylines for every run: start -> lane in the cable channel outside the rails (unit numbers stay visible) -> end.
 * Per side, lanes are assigned by vertical span (longest run outermost) so nested runs never cross.
 */
export function routeCables(lib: Library, design: RackDesign, rack: RackTemplate, geo: RackGeometry): RoutedCable[] {
  const find = (id: string) => design.placements.find((p) => p.id === id);
  const ends = design.cables.map((run) => {
    const point = (ep: { placementId: string }) => { const p = find(ep.placementId); return p && exitPoint(lib, rack, geo, p, run.route); };
    const ss = run.from.map(point).filter((e): e is [number, number] => !!e);
    const es = run.to.map(point).filter((e): e is [number, number] => !!e);
    if (!ss.length || !es.length) return undefined;
    const ys = [...ss, ...es].map((p) => p[1]);
    return { run, ss, es, span: Math.max(...ys) - Math.min(...ys) };
  }).filter((x): x is NonNullable<typeof x> => !!x);

  const out: RoutedCable[] = [];
  for (const side of ['left', 'right'] as const) {
    const runs = ends.filter((x) => x.run.route === side).sort((a, b) => a.span - b.span); // shortest = innermost
    const room = Math.max(6, geo.gutter - 6);
    const step = Math.min(6, room / Math.max(1, runs.length));
    // Outer edge of the frame (outside the rails and their unit numbers).
    const frameEdge = side === 'left' ? geo.originX : geo.originX + geo.railW * 2 + geo.bodyW;
    runs.forEach(({ run, ss, es }, i) => {
      const off = 4 + i * step;
      const lane = side === 'left' ? frameEdge - off : frameEdge + off;
      // One stub per endpoint into the lane, plus a spine joining them all.
      const ends = [...ss, ...es];
      const ys = ends.map((p) => p[1]);
      const spine: [number, number][] = [[lane, Math.min(...ys)], [lane, Math.max(...ys)]];
      out.push({ run, starts: ss.length, paths: [spine, ...ends.map((p): [number, number][] => [p, [lane, p[1]]])] });
    });
  }
  return out;
}
