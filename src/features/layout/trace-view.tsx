import { useEffect, useState, type Ref } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { defaultCollapsed, TRACE_GEOM, traceDrawing, type TopoTrace } from '../../domain/layout/topo-trace';
import { categoryStyle, paint, RACK_FRAME } from '../../theme/paint';

/** Drawing scale: 1 unit = 1 px at 100 %. */
const FONT = 12;

/**
 * A traced topology: devices in columns by hops from side A (A devices left, outlined in the accent), devices of
 * one rack grouped in a rack block, one line per connected pair labelled with its port count. Click a block's
 * header (▾ / ▸) to collapse it into a device summary; big blocks start collapsed.
 */
export function TraceView({ ref, lib, designs, layout, trace, initialCollapsed }: {
  ref?: Ref<SVGSVGElement>; lib: Library; designs: DesignLookup; layout: DcLayout; trace: TopoTrace;
  /** Blocks collapsed at first (default: the big ones). */
  initialCollapsed?: Set<string>;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => initialCollapsed ?? defaultCollapsed(lib, designs, layout, trace));
  useEffect(() => setCollapsed(defaultCollapsed(lib, designs, layout, trace)), [trace.id]);
  const toggle = (k: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const d = traceDrawing(lib, designs, layout, trace, collapsed);
  const byKey = new Map(d.nodes.map((n) => [n.key, n]));
  const G = TRACE_GEOM;
  const title = 28;
  const lines = d.edges.map((e) => {
    const [p, q] = [byKey.get(e.a)!, byKey.get(e.b)!].sort((m, n) => m.x - n.x || m.y - n.y);
    let pts: { x: number; y: number }[];
    let badge: { x: number; y: number };
    if (p.x === q.x) {
      // Same column: a bracket out to the left on its own lane (lanes never overlap). Badge on the bracket.
      const x = p.x - G.rackPad - 12 - (e.lane ?? 0) * G.lane;
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
        {`${trace.name} · ${d.racks.reduce((n, r) => n + r.devices, 0)} devices · ${d.edges.reduce((n, e) => n + e.count, 0)} ports linked`}
      </text>
      {d.racks.map((r) => (
        <g key={r.key}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={6} fill={RACK_FRAME.side} stroke={RACK_FRAME.sideLine} />
          <g style={{ cursor: 'pointer' }} onClick={() => toggle(r.key)}>
            <title>{r.collapsed ? 'Expand: show every device' : 'Collapse into a device summary'}</title>
            <rect x={r.x} y={r.y} width={r.w} height={G.rackHead} fill="transparent" />
            <text x={r.x + 8} y={r.y + 15} fontWeight={700} fill={RACK_FRAME.sideText}>
              <tspan data-export="skip">{r.collapsed ? '▸ ' : '▾ '}</tspan>{`${r.label}${r.collapsed ? '' : ` · ${r.devices}`}`}
            </text>
          </g>
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
        const s = categoryStyle(n.device?.category ?? 'other');
        const sub = n.sub.length > 32 ? `${n.sub.slice(0, 31)}…` : n.sub;
        return (
          <g key={n.key}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={4} fill={s.fill} stroke={n.side ? paint.accent : s.stroke} strokeWidth={n.side ? 2.5 : 1}
              strokeDasharray={n.devices ? '4 2' : undefined} />
            <text x={n.x + 8} y={n.y + 17} fontWeight={700} fill={s.text}>{n.side ? `${n.side.toUpperCase()} · ${n.label}` : n.label}</text>
            <text x={n.x + 8} y={n.y + 33} fill={s.text} opacity={0.8}>{sub}<title>{n.sub}</title></text>
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
