import type { Ref } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { TRACE_GEOM, traceDrawing, type TopoTrace } from '../../domain/layout/topo-trace';
import { categoryStyle, paint, RACK_FRAME } from '../../theme/paint';

/** Drawing scale: 1 unit = 1 px at 100 %. */
const FONT = 12;

/**
 * A traced topology: devices in columns by hops from side A (A devices left, outlined in the accent), devices of
 * one rack grouped in a rack box, one line per connected device pair labelled with its link count.
 */
export function TraceView({ ref, lib, designs, layout, trace }: { ref?: Ref<SVGSVGElement>; lib: Library; designs: DesignLookup; layout: DcLayout; trace: TopoTrace }) {
  const d = traceDrawing(lib, designs, layout, trace);
  const byKey = new Map(d.nodes.map((n) => [n.key, n]));
  const G = TRACE_GEOM;
  const title = 28;
  const lines = d.edges.map((e) => {
    const [p, q] = [byKey.get(e.a)!, byKey.get(e.b)!].sort((m, n) => m.x - n.x || m.y - n.y);
    let pts: { x: number; y: number }[];
    let badge: { x: number; y: number };
    if (p.x === q.x) {
      // Same column: a bracket out to the LEFT (the right side carries the links to the next column); one lane per
      // pair, farther out for longer brackets. Badge beside the far box.
      const x = p.x - G.rackPad - 8 - (Math.abs(q.y - p.y) / (G.nodeH + G.rowGap)) * 12;
      pts = [{ x: p.x, y: p.y + p.h / 2 }, { x, y: p.y + p.h / 2 }, { x, y: q.y + q.h / 2 }, { x: q.x, y: q.y + q.h / 2 }];
      badge = { x, y: (p.y + p.h / 2 + q.y + q.h / 2) / 2 };
    } else {
      const mx = p.x + p.w + G.rackPad + G.colGap / 2;
      pts = [{ x: p.x + p.w, y: p.y + p.h / 2 }, { x: mx, y: p.y + p.h / 2 }, { x: mx, y: q.y + q.h / 2 }, { x: q.x, y: q.y + q.h / 2 }];
      // On the branch into the right box, so every link has its own label.
      badge = { x: q.x - G.rackPad - 22, y: q.y + q.h / 2 };
    }
    return { e, pts, badge };
  });
  const height = d.height + title;
  return (
    <svg ref={ref} width={d.width} viewBox={`0 ${-title} ${d.width} ${height}`} fontSize={FONT} style={{ display: 'block' }}>
      <rect x={0} y={-title} width={d.width} height={height} fill={paint.paper} />
      <text x={G.margin} y={-8} fontSize={14} fontWeight={700} fill={paint.ink}>
        {`${trace.name} · ${d.nodes.length} devices · ${d.edges.reduce((n, e) => n + e.count, 0)} ports linked`}
      </text>
      {d.racks.map((r) => (
        <g key={`${r.assignmentId}@${r.x}`}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={6} fill={RACK_FRAME.side} stroke={RACK_FRAME.sideLine} />
          <text x={r.x + 8} y={r.y + 15} fontWeight={700} fill={RACK_FRAME.sideText}>{r.label}</text>
        </g>
      ))}
      {/* Casings first, then lines, then labels: later lines never cut earlier ones. */}
      {lines.map(({ e, pts }) => (
        <polyline key={`c${e.a}|${e.b}`} points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={paint.paper} strokeWidth={5} />
      ))}
      {lines.map(({ e, pts }) => (
        <polyline key={`l${e.a}|${e.b}`} points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={paint.accent} strokeWidth={1.6}
          strokeDasharray={e.kinds.includes('cross') ? undefined : '5 3'}>
          <title>{`${e.count} port${e.count === 1 ? '' : 's'}${e.media.length ? ` · ${e.media.join(', ')}` : ''}`}</title>
        </polyline>
      ))}
      {d.nodes.map((n) => {
        const s = n.device ? categoryStyle(n.device.category) : categoryStyle('other');
        return (
          <g key={n.key}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={4} fill={s.fill} stroke={n.side ? paint.accent : s.stroke} strokeWidth={n.side ? 2.5 : 1} />
            <text x={n.x + 8} y={n.y + 17} fontWeight={700} fill={s.text}>{n.side ? `${n.side.toUpperCase()} · ${n.label}` : n.label}</text>
            <text x={n.x + 8} y={n.y + 33} fill={s.text} opacity={0.8}>{`${n.device?.name ?? ''}`.slice(0, 30)}</text>
          </g>
        );
      })}
      {lines.map(({ e, badge: m }) => {
        const t = `${e.count}`;
        return (
          <g key={`t${e.a}|${e.b}`}>
            <rect x={m.x - 4 - t.length * 3.6} y={m.y - 8} width={8 + t.length * 7.2} height={16} rx={8} fill={paint.paper} stroke={paint.accent} />
            <text x={m.x} y={m.y + 4} textAnchor="middle" fontSize={11} fill={paint.ink}>{t}</text>
          </g>
        );
      })}
    </svg>
  );
}
