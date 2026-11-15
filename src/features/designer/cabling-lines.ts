import type { CableEndpoint, CableRun } from '../../domain/design/types';

/** A connector on the cabling view: its centre and the gaps above / below its device box. */
export interface LegAnchor {
  x: number;
  y: number;
  /** y of the free gap just above / below the device box (where stubs turn toward the channel). */
  gapAbove: number;
  gapBelow: number;
}

export interface CablingLine {
  key: string;
  runId: string;
  /** Orthogonal polyline: connector -> device gap -> channel lane -> device gap -> connector. */
  points: [number, number][];
  a: CableEndpoint;
  b: CableEndpoint;
}

/**
 * Routes every assigned cable as in the elevation: out of each connector to the gap above or below its device
 * (whichever is nearer), along the gap to the run's side channel (`left` / `right`), along its lane, and back in.
 * Per side, runs get nested lanes by vertical span (shortest innermost), so runs on one side never cross in the
 * channel. One line per A-B connector pair; all pairs of a run share its lane.
 */
export function routeCablingLines(
  runs: CableRun[],
  anchors: Map<string, LegAnchor>,
  keyOf: (ep: CableEndpoint) => string,
  channel: { left: number; right: number; width: number },
): CablingLine[] {
  const turn = (a: LegAnchor) => (a.y - a.gapAbove <= a.gapBelow - a.y ? a.gapAbove : a.gapBelow);
  const placed = runs.map((run) => {
    const pairs = run.from.flatMap((f, i) => run.to.map((t, j) => {
      const a = anchors.get(keyOf(f));
      const b = anchors.get(keyOf(t));
      return a && b ? { i, j, a, b, fa: f, tb: t } : undefined;
    })).filter((x): x is NonNullable<typeof x> => !!x);
    const ys = pairs.flatMap((p) => [turn(p.a), turn(p.b)]);
    return { run, pairs, span: ys.length ? Math.max(...ys) - Math.min(...ys) : 0 };
  }).filter((r) => r.pairs.length);

  const out: CablingLine[] = [];
  for (const side of ['left', 'right'] as const) {
    const list = placed.filter((r) => r.run.route === side).sort((a, b) => a.span - b.span);
    const step = Math.min(4, (channel.width - 8) / Math.max(1, list.length));
    list.forEach(({ run, pairs }, n) => {
      // Innermost lane sits next to the devices; outer lanes move away from them.
      const lane = side === 'left' ? channel.left + channel.width - 4 - n * step : channel.right + 4 + n * step;
      for (const p of pairs) {
        const ya = turn(p.a);
        const yb = turn(p.b);
        out.push({
          key: `${run.id}:${p.i}:${p.j}`, runId: run.id, a: p.fa, b: p.tb,
          points: [[p.a.x, p.a.y], [p.a.x, ya], [lane, ya], [lane, yb], [p.b.x, yb], [p.b.x, p.b.y]],
        });
      }
    });
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
