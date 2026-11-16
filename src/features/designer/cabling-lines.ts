import type { CableEndpoint, CableRun } from '../../domain/design/types';

export type CablingFace = 'front' | 'rear';

/** A connector on the cabling view: its centre, the gaps above / below its device box, and its face block. */
export interface LegAnchor {
  x: number;
  y: number;
  /** y of the free gap just above / below the device box (where stubs turn toward the channel). */
  gapAbove: number;
  gapBelow: number;
  /** Face block the connector is drawn in; its cables use that block's own left / right channels. */
  face: CablingFace;
  /** Leaves straight sideways to the channel at its own height (side PDU strips) instead of via a device gap. */
  sideways?: boolean;
}

/** Cable channels of one face block: x where its left / right channel starts, and their width. */
export interface FaceChannels {
  left: number;
  right: number;
  width: number;
}

export interface CablingLine {
  key: string;
  runId: string;
  /** Orthogonal polyline: connector -> device gap -> channel lane (-> top band -> other face's lane) -> connector. */
  points: [number, number][];
  a: CableEndpoint;
  b: CableEndpoint;
}

/**
 * Routes every assigned cable as in the elevation, front and rear each with their own left and right channels:
 * out of each connector to the gap above or below its device (the nearer), along the gap to the route's channel
 * of its own face block, along its lane, and back in. A front-rear run goes up its lane to the band above the
 * devices, across to the other face's channel on the same route side, and down its lane there.
 * Per channel, runs get nested lanes by vertical span (shortest innermost), so runs in one channel never cross.
 */
export function routeCablingLines(
  runs: CableRun[],
  anchors: Map<string, LegAnchor>,
  keyOf: (ep: CableEndpoint) => string,
  channels: Record<CablingFace, FaceChannels>,
  bandY: number,
): CablingLine[] {
  const turn = (a: LegAnchor) => (a.sideways ? a.y : a.y - a.gapAbove <= a.gapBelow - a.y ? a.gapAbove : a.gapBelow);
  const placed = runs.map((run) => {
    const pairs = run.from.flatMap((f, i) => run.to.map((t, j) => {
      const a = anchors.get(keyOf(f));
      const b = anchors.get(keyOf(t));
      return a && b ? { i, j, a, b, fa: f, tb: t } : undefined;
    })).filter((x): x is NonNullable<typeof x> => !!x);
    const cross = pairs.some((p) => p.a.face !== p.b.face);
    const ys = pairs.flatMap((p) => [turn(p.a), turn(p.b)]);
    // A front-rear run climbs to the band: its span reaches from its lowest end to the band.
    const span = ys.length ? Math.max(...ys) - (cross ? bandY : Math.min(...ys)) : 0;
    return { run, pairs, span, faces: new Set(pairs.flatMap((p) => [p.a.face, p.b.face])) };
  }).filter((r) => r.pairs.length);

  // Lane x per (face, run): nested per face block and route side.
  const laneOf = new Map<string, number>();
  for (const face of ['front', 'rear'] as const) {
    const ch = channels[face];
    for (const side of ['left', 'right'] as const) {
      const list = placed.filter((r) => r.run.route === side && r.faces.has(face)).sort((a, b) => a.span - b.span);
      const step = Math.min(4, (ch.width - 8) / Math.max(1, list.length));
      list.forEach(({ run }, n) => {
        // Innermost lane sits next to the block's devices; outer lanes move away from them.
        laneOf.set(`${face}|${run.id}`, side === 'left' ? ch.left + ch.width - 4 - n * step : ch.right + 4 + n * step);
      });
    }
  }

  const out: CablingLine[] = [];
  for (const { run, pairs } of placed) {
    for (const p of pairs) {
      const ya = turn(p.a);
      const yb = turn(p.b);
      const la = laneOf.get(`${p.a.face}|${run.id}`)!;
      const lb = laneOf.get(`${p.b.face}|${run.id}`)!;
      const mid: [number, number][] = p.a.face === p.b.face
        ? [[la, ya], [la, yb]]
        : [[la, ya], [la, bandY], [lb, bandY], [lb, yb]];
      out.push({
        key: `${run.id}:${p.i}:${p.j}`, runId: run.id, a: p.fa, b: p.tb,
        points: [[p.a.x, p.a.y], [p.a.x, ya], ...mid, [p.b.x, yb], [p.b.x, p.b.y]],
      });
    }
  }
  return out;
}

/**
 * Runs to highlight: every run on a selected connector plus the run selected in the inspector (if it still
 * exists). Hover does not change it. Empty = nothing highlighted.
 */
export function focusedRuns(runs: CableRun[], usedBy: Map<string, string>, selectedKeys: Iterable<string>, selected?: string): Set<string> {
  const out = new Set<string>();
  for (const k of selectedKeys) { const r = usedBy.get(k); if (r) out.add(r); }
  if (selected && runs.some((r) => r.id === selected)) out.add(selected);
  return out;
}
