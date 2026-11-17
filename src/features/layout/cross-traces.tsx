import { useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { crossTraces, offsetPath } from '../../domain/layout/cross-cables';
import type { FloorPlan } from '../../domain/layout/floor-plan';
import { paint } from '../../theme/paint';

/**
 * Trace colours, one per rack pair in turn: distinct from the rack fill (theme accent), the data tray blue and the
 * alert hues (red / orange / yellow); each line has a thin paper casing so it reads over racks, trays and aisles.
 */
export const TRACE_COLORS = ['#10B981', '#8B5CF6', '#06B6D4', '#84CC16', '#6366F1', '#14B8A6', '#D946EF', '#22C55E'];
/** Line width and the sideways spacing between traces sharing a tray (mm). */
const LINE = 28;
const LANE = 70;

type P = { x: number; y: number };
const str = (pts: P[]) => pts.map((p) => `${p.x},${p.y}`).join(' ');

/**
 * Cross-rack cable traces: one thin line per rack pair (cables aggregated), starting at the racks' edges, each pair in
 * its own colour and lane; hover shows cable and fiber counts.
 */
export function CrossTraces({ lib, designs, layout, plan, highlight, onHover }: {
  lib: Library; designs: DesignLookup; layout: DcLayout; plan: FloorPlan;
  /** Racks whose traces are drawn strong (the A / B sides). */
  highlight?: string[];
  onHover(text: string | undefined, e?: { clientX: number; clientY: number }): void;
}) {
  const traces = crossTraces(lib, designs, layout, plan);
  const [over, setOver] = useState<string>();
  if (!traces.length) return null;
  // Each pair gets its own lane, so traces sharing a tray run side by side instead of on top of each other.
  const drawn = traces.map((t, i) => ({
    t, color: TRACE_COLORS[i % TRACE_COLORS.length],
    points: offsetPath(t.points, (i - (traces.length - 1) / 2) * LANE),
    strong: over === t.key || !highlight?.length || (highlight.includes(t.a.id) && highlight.includes(t.b.id)),
  }));
  return (
    <g data-cross-traces="">
      {/* casings first, then lines, then hover targets (SVG has no z-index) */}
      {drawn.map(({ t, points, strong }) => (
        <polyline key={`c${t.key}`} points={str(points)} fill="none" stroke={paint.paper} strokeWidth={LINE + 24}
          strokeOpacity={strong ? 0.9 : 0.3} strokeLinejoin="round" pointerEvents="none" />
      ))}
      {drawn.map(({ t, points, color, strong }) => (
        <g key={`l${t.key}`} pointerEvents="none" opacity={strong ? 1 : 0.35}>
          <polyline points={str(points)} fill="none" stroke={color} strokeWidth={over === t.key ? LINE * 2 : LINE} strokeLinejoin="round" />
          {[points[0], points[points.length - 1]].map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={LINE * 1.8} fill={color} stroke={paint.paper} strokeWidth={14} />
          ))}
        </g>
      ))}
      {drawn.map(({ t, points }) => {
        const text = `${t.a.label} ↔ ${t.b.label}: ${t.cables} cable${t.cables === 1 ? '' : 's'}, ${t.fibers} fibers`;
        return (
          <polyline key={`h${t.key}`} data-export="skip" points={str(points)} fill="none" stroke="transparent" strokeWidth={LANE}
            onPointerEnter={(e) => { setOver(t.key); onHover(text, e); }}
            onPointerMove={(e) => onHover(text, e)}
            onPointerLeave={() => { setOver(undefined); onHover(undefined); }} />
        );
      })}
    </g>
  );
}
