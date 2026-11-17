import { useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { crossTraces } from '../../domain/layout/cross-cables';
import type { FloorPlan } from '../../domain/layout/floor-plan';
import { paint } from '../../theme/paint';

/** Cross-rack cable traces: one line per rack pair (cables aggregated), hover shows cable and fiber counts. */
export function CrossTraces({ lib, designs, layout, plan, highlight, onHover }: {
  lib: Library; designs: DesignLookup; layout: DcLayout; plan: FloorPlan;
  /** Racks whose traces are drawn strong (the A / B sides). */
  highlight?: string[];
  onHover(text: string | undefined, e?: { clientX: number; clientY: number }): void;
}) {
  const traces = crossTraces(lib, designs, layout, plan);
  const [over, setOver] = useState<string>();
  if (!traces.length) return null;
  return (
    <g data-cross-traces="">
      {traces.map((t) => {
        const pts = t.points.map((p) => `${p.x},${p.y}`).join(' ');
        const strong = over === t.key || !highlight?.length || (highlight.includes(t.a.id) && highlight.includes(t.b.id));
        const text = `${t.a.label} ↔ ${t.b.label}: ${t.cables} cable${t.cables === 1 ? '' : 's'}, ${t.fibers} fibers`;
        return (
          <g key={t.key}>
            <polyline points={pts} fill="none" stroke={paint.selection} strokeWidth={over === t.key ? 120 : 70}
              strokeOpacity={strong ? 0.9 : 0.3} strokeLinejoin="round" pointerEvents="none" />
            <circle cx={t.points[0].x} cy={t.points[0].y} r={110} fill={paint.selection} pointerEvents="none" />
            <circle cx={t.points[t.points.length - 1].x} cy={t.points[t.points.length - 1].y} r={110} fill={paint.selection} pointerEvents="none" />
            <polyline data-export="skip" points={pts} fill="none" stroke="transparent" strokeWidth={300}
              onPointerEnter={(e) => { setOver(t.key); onHover(text, e); }}
              onPointerMove={(e) => onHover(text, e)}
              onPointerLeave={() => { setOver(undefined); onHover(undefined); }}>
              <title>{text}</title>
            </polyline>
          </g>
        );
      })}
    </g>
  );
}
