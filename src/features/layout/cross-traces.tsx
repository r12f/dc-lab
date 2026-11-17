import { useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { crossTraces, traceBundles, type CrossTrace } from '../../domain/layout/cross-cables';
import type { FloorPlan } from '../../domain/layout/floor-plan';
import { paint } from '../../theme/paint';
import { useLabels } from './view-context';

/**
 * Trace colours, one per rack pair in turn: deep greens and magentas, far from the rack fill (theme accent), the tray
 * blue, the aisle violet / blue and the alert hues (red / orange / yellow); each line has a paper casing so it reads
 * over racks, trays and aisles in light and dark themes.
 */
export const TRACE_COLORS = ['#059669', '#C026D3', '#65A30D', '#0F766E', '#A21CAF', '#15803D'];
/** Line width on screen (px, the same at any zoom). */
const LINE_PX = 2.6;
/** Shortest shared run (mm) that gets a count badge, and the badge size (mm). */
const MIN_RUN = 1000;
const BADGE_FONT = 130;

type P = { x: number; y: number };
const str = (pts: P[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');
const summary = (ts: CrossTrace[]) => {
  const cables = ts.reduce((n, t) => n + t.cables, 0);
  const fibers = ts.reduce((n, t) => n + t.fibers, 0);
  return `${cables} cable${cables === 1 ? '' : 's'}, ${fibers} fibers`;
};

/**
 * Cross-rack cable traces: one thin line per rack pair (cables aggregated) from the midpoint of one rack's edge to the
 * other's. Traces sharing a tray are drawn on top of each other; each shared run shows a badge with the number of
 * traces on it. Hover a line or a badge for the pairs, cable and fiber counts.
 */
export function CrossTraces({ lib, designs, layout, plan, highlight, onHover }: {
  lib: Library; designs: DesignLookup; layout: DcLayout; plan: FloorPlan;
  /** Racks whose traces are drawn strong (the A / B sides). */
  highlight?: string[];
  onHover(text: string | undefined, e?: { clientX: number; clientY: number }): void;
}) {
  const traces = crossTraces(lib, designs, layout, plan);
  const [over, setOver] = useState<string>();
  const { upright } = useLabels();
  if (!traces.length) return null;
  const byKey = new Map(traces.map((t) => [t.key, t]));
  const drawn = traces.map((t, i) => ({
    t, color: TRACE_COLORS[i % TRACE_COLORS.length], points: t.points,
    strong: over === t.key || !highlight?.length || (highlight.includes(t.a.id) && highlight.includes(t.b.id)),
  }));
  const bundles = traceBundles(traces).filter((b) => Math.abs(b.a.x - b.b.x) + Math.abs(b.a.y - b.b.y) >= MIN_RUN);
  const hover = (key: string | undefined, text: string | undefined) => ({
    onPointerEnter: (e: { clientX: number; clientY: number }) => { setOver(key); onHover(text, e); },
    onPointerMove: (e: { clientX: number; clientY: number }) => onHover(text, e),
    onPointerLeave: () => { setOver(undefined); onHover(undefined); },
  });
  return (
    <g data-cross-traces="">
      {/* casings first, then lines, then hover targets, then badges (SVG has no z-index) */}
      {drawn.map(({ t, points, strong }) => (
        <polyline key={`c${t.key}`} points={str(points)} fill="none" stroke={paint.paper} strokeWidth={LINE_PX + 3} vectorEffect="non-scaling-stroke"
          strokeOpacity={strong ? 0.9 : 0.3} strokeLinejoin="round" pointerEvents="none" />
      ))}
      {drawn.map(({ t, points, color, strong }) => (
        <g key={`l${t.key}`} pointerEvents="none" opacity={strong ? 1 : 0.35}>
          <polyline points={str(points)} fill="none" stroke={color} strokeWidth={over === t.key ? LINE_PX * 2.5 : LINE_PX}
            vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {[points[0], points[points.length - 1]].map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={60} fill={color} stroke={paint.paper} strokeWidth={15} />)}
        </g>
      ))}
      {drawn.map(({ t, points }) => (
        <polyline key={`h${t.key}`} data-export="skip" points={str(points)} fill="none" stroke="transparent" strokeWidth={80}
          {...hover(t.key, `${t.a.label} ↔ ${t.b.label}: ${summary([t])}`)} />
      ))}
      {bundles.map((b, i) => {
        const x = (b.a.x + b.b.x) / 2;
        const y = (b.a.y + b.b.y) / 2;
        const ts = b.keys.map((k) => byKey.get(k)!).filter(Boolean);
        const label = String(b.keys.length);
        const w = BADGE_FONT * (0.75 + 0.6 * label.length);
        const text = `${b.keys.length} traces: ${summary(ts)}\n${ts.map((t) => `${t.a.label} ↔ ${t.b.label}`).join(', ')}`;
        return (
          <g key={`b${i}`} transform={upright(x, y)} {...hover(undefined, text)}>
            <rect x={x - w / 2} y={y - BADGE_FONT * 0.7} width={w} height={BADGE_FONT * 1.4} rx={BADGE_FONT * 0.7}
              fill={paint.ink} stroke={paint.paper} strokeWidth={30} />
            <text x={x} y={y + BADGE_FONT * 0.36} fontSize={BADGE_FONT} fontWeight={700} textAnchor="middle" fill={paint.paper}>{label}</text>
          </g>
        );
      })}
    </g>
  );
}
