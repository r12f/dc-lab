import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { defaultCollapsed, moveBlocks, topBlockOf, TRACE_GEOM, traceDrawing, type TopoTrace, type TraceEdge } from '../../domain/layout/topo-trace';
import { useTraces, type BlockOffset } from '../../state/traces';
import { categoryStyle, LAYOUT_PAINT, paint, RACK_FRAME } from '../../theme/paint';

/** Drawing scale: 1 unit = 1 px at 100 %. */
const FONT = 12;
/** Gap between parallel lines of one box pair (one per cable type). */
const PAR = 9;

const edgeKey = (e: TraceEdge) => `${e.a}|${e.b}|${e.mediaId}`;
/** Hover text of a line: how many cables of which type, and the ports they join. */
const tip = (e: TraceEdge) => `${e.cables} × ${e.media || 'unknown cable'} · ${e.count} port${e.count === 1 ? '' : 's'}${e.kinds.includes('cross') ? ' · cross-rack' : ''}`;

/** Cuts a label to `n` characters with an ellipsis (full text in the tooltip). */
const fit = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * A traced topology: devices in columns by hops from side A (A devices left, outlined in the accent), devices of
 * one rack grouped in a rack block, racks of one design inside a design group block; one line per connected pair
 * labelled with its cable count. Click a block's header (▾ / ▸) to fold / unfold it; groups and big racks start folded.
 * Drag a block (anywhere on it) to move it; lines follow (the canvas toolbar's ↺ Reset layout puts blocks back).
 */
export function TraceView({ ref, lib, designs, layout, trace, initialCollapsed }: {
  ref?: Ref<SVGSVGElement>; lib: Library; designs: DesignLookup; layout: DcLayout; trace: TopoTrace;
  /** Blocks collapsed at first (default: the big ones). */
  initialCollapsed?: Set<string>;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => initialCollapsed ?? defaultCollapsed(lib, designs, layout, trace));
  useEffect(() => setCollapsed(defaultCollapsed(lib, designs, layout, trace)), [trace.id]);
  const toggle = (k: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const saved = useTraces((s) => s.offsets[trace.id]);
  const setOffset = useTraces((s) => s.setOffset);
  // Live drag: the block being dragged and its offset so far (committed to the store on release).
  const [drag, setDrag] = useState<{ key: string; o: BlockOffset }>();
  const moved = useRef(false);
  const svgEl = useRef<SVGSVGElement | null>(null);
  const offsets = { ...saved, ...(drag ? { [drag.key]: drag.o } : {}) };
  const base = traceDrawing(lib, designs, layout, trace, collapsed);
  const d = moveBlocks(base, offsets);
  /** Drawing coordinates of a pointer (CSS zoom-safe via the screen CTM). */
  const toSvg = (e: { clientX: number; clientY: number }) => {
    const m = svgEl.current?.getScreenCTM();
    if (!m) return { x: e.clientX, y: e.clientY };
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  };
  /** Press on a block (header, body or a box in it): dragging moves the whole top-level block. */
  const startDrag = (box: { x: number; y: number; w: number; h: number }) => (ev: ReactPointerEvent) => {
    moved.current = false;
    if (ev.button !== 0) return;
    // `box` comes from the drawn (moved) drawing: find its block there, not in the unmoved one — a dragged block no
    // longer sits where it was, so looking it up in `base` failed and left `moved` stuck (clicks stopped folding).
    const shown = topBlockOf(d, box);
    const top = shown && base.racks.find((r) => r.key === shown.key);
    if (!top) return;
    const start = toSvg(ev);
    const from = saved?.[top.key] ?? { dx: 0, dy: 0 };
    // Blocks stay inside the drawing's top-left corner (the drawing grows to the right / down).
    const clamp = (dx: number, dy: number) => ({ dx: Math.max(4 - top.x, dx), dy: Math.max(4 - top.y, dy) });
    const move = (e: PointerEvent) => {
      const p = toSvg(e);
      const o = clamp(from.dx + p.x - start.x, from.dy + p.y - start.y);
      if (Math.abs(p.x - start.x) + Math.abs(p.y - start.y) > 3) moved.current = true;
      if (moved.current) setDrag({ key: top.key, o });
    };
    const up = (e: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const p = toSvg(e);
      if (moved.current) setOffset(trace.id, top.key, clamp(from.dx + p.x - start.x, from.dy + p.y - start.y));
      setDrag(undefined);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const setRef = (el: SVGSVGElement | null) => {
    svgEl.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as { current: SVGSVGElement | null }).current = el;
  };
  const mediaName = (id: string) => lib.cableMedia.get(id)?.name ?? id;
  const byKey = new Map(d.nodes.map((n) => [n.key, n]));
  const G = TRACE_GEOM;
  const title = 50;
  // Each cable type in the trace gets its own colour (catalog colours repeat, e.g. two blue copper types) and its own
  // offset, so lines of different types never run on top of each other, even on a shared trunk.
  const types = [...new Set(d.edges.map((e) => e.mediaId))].sort((x, y) => (mediaName(x) < mediaName(y) ? -1 : 1));
  const typeIdx = new Map(types.map((m, i) => [m, i]));
  const colorOf = (m: string) => LAYOUT_PAINT.traces[typeIdx.get(m)! % LAYOUT_PAINT.traces.length];
  const lines = d.edges.map((e) => {
    const [p, q] = [byKey.get(e.a)!, byKey.get(e.b)!].sort((m, n) => m.x - n.x || m.y - n.y);
    let pts: { x: number; y: number }[];
    let badge: { x: number; y: number };
    // Parallel lines of one box pair (one per cable type) sit PAR px apart, centred on the box middle.
    const off = (typeIdx.get(e.mediaId)! - (types.length - 1) / 2) * PAR;
    const [py, qy] = [p.y + p.h / 2 + off, q.y + q.h / 2 + off];
    if (q.x < p.x + p.w + 24) {
      // Same column (or blocks dragged over each other): a bracket out to the left on its own lane. Badge on it.
      const x = Math.min(p.x, q.x) - G.rackPad - 12 - (e.lane ?? 0) * G.lane;
      pts = [{ x: p.x, y: py }, { x, y: py }, { x, y: qy }, { x: q.x, y: qy }];
      badge = { x, y: (py + qy) / 2 };
    } else {
      // Turn halfway across the gap between the boxes (dragged blocks keep a clean elbow).
      const mx = (p.x + p.w + q.x) / 2 + off;
      pts = [{ x: p.x + p.w, y: py }, { x: mx, y: py }, { x: mx, y: qy }, { x: q.x, y: qy }];
      // On the branch into the right box (staggered per parallel line), so every line has its own label.
      badge = { x: q.x - G.rackPad - 18 - e.index * 28, y: qy };
    }
    return { e, pts, badge };
  });
  const height = d.height + title;
  return (
    <svg ref={setRef} width={d.width} viewBox={`0 ${-title} ${d.width} ${height}`} fontSize={FONT} style={{ display: 'block' }}>
      <rect x={0} y={-title} width={d.width} height={height} fill={paint.paper} />
      <text x={G.margin} y={-title + 18} fontSize={14} fontWeight={700} fill={paint.ink}>
        {`${trace.name} · ${d.racks.filter((r) => r.level === 0).reduce((n, r) => n + r.devices, 0)} devices · ${d.edges.reduce((n, e) => n + e.cables, 0)} cables · ${d.edges.reduce((n, e) => n + e.count, 0)} ports`}
      </text>
      {/* Legend: one swatch per cable type, after the title. */}
      {types.map((m, i) => (
        <g key={`lg${m}`} transform={`translate(${G.margin + i * 240}, ${-title + 38})`}>
          <line x1={0} y1={0} x2={22} y2={0} stroke={colorOf(m)} strokeWidth={2.2} />
          <text x={28} y={4} fontSize={11} fill={paint.ink}>{mediaName(m).length > 34 ? `${mediaName(m).slice(0, 33)}…` : mediaName(m)}<title>{mediaName(m)}</title></text>
        </g>
      ))}
      {/* Design groups first, the racks inside them on top (SVG has no z-index). */}
      {[...d.racks].sort((a, b) => b.racks - a.racks).map((r) => (
        <g key={r.key}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={6} fill={RACK_FRAME.side} stroke={RACK_FRAME.sideLine}
            strokeWidth={r.racks > 1 ? 1.5 : 1} style={{ cursor: drag ? 'grabbing' : 'grab' }} onPointerDown={startDrag(r)} />
          <g style={{ cursor: 'pointer' }} onPointerDown={startDrag(r)} onClick={() => { if (!moved.current) toggle(r.key); }}>
            <title>{r.racks > 1 ? (r.collapsed ? 'Expand: show each rack' : 'Collapse the racks into one summary') : r.collapsed ? 'Expand: show every device' : 'Collapse into a device summary'}</title>
            <rect x={r.x} y={r.y} width={r.w} height={G.rackHead} fill="none" pointerEvents="all" />
            <text x={r.x + 8} y={r.y + 15} fontWeight={700} fill={RACK_FRAME.sideText}>
              <tspan data-export="skip">{r.collapsed ? '▸ ' : '▾ '}</tspan>{fit(r.label, 31)}
              <title>{r.label}</title>
            </text>
          </g>
        </g>
      ))}
      {/* Casings first, then lines, then labels: later lines never cut earlier ones. */}
      {lines.map(({ e, pts }) => (
        <polyline key={`c${edgeKey(e)}`} points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={paint.paper} strokeWidth={5} />
      ))}
      {/* One line per cable type and box pair, in the cable type's own colour; in-rack cables dashed. */}
      {lines.map(({ e, pts }) => (
        <polyline key={`l${edgeKey(e)}`} points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={colorOf(e.mediaId)} strokeWidth={2.2}
          strokeDasharray={e.kinds.includes('cross') ? undefined : '5 3'} />
      ))}
      {/* Hover targets on top (wide, invisible): cable count and type. */}
      {lines.map(({ e, pts }) => (
        <polyline key={`h${edgeKey(e)}`} data-export="skip" points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="transparent" strokeWidth={8} pointerEvents="stroke">
          <title>{tip(e)}</title>
        </polyline>
      ))}
      {d.nodes.map((n) => {
        const s = categoryStyle(n.device?.category ?? 'other');
        const sub = n.sub.length > 32 ? `${n.sub.slice(0, 31)}…` : n.sub;
        return (
          <g key={n.key} style={{ cursor: drag ? 'grabbing' : 'grab' }} onPointerDown={startDrag(n)}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={4} fill={s.fill} stroke={n.side ? paint.accent : s.stroke} strokeWidth={n.side ? 2.5 : 1}
              strokeDasharray={n.devices ? '4 2' : undefined} />
            <text x={n.x + 8} y={n.y + 17} fontWeight={700} fill={s.text}>{n.side ? `${n.side.toUpperCase()} · ${n.label}` : n.label}</text>
            <text x={n.x + 8} y={n.y + 33} fill={s.text} opacity={0.8}>{sub}<title>{n.sub}</title></text>
          </g>
        );
      })}
      {lines.map(({ e, badge: m }) => {
        const t = `${e.cables}`;
        return (
          <g key={`t${edgeKey(e)}`}>
            <title>{tip(e)}</title>
            <rect x={m.x - 4 - t.length * 3.6} y={m.y - 7} width={8 + t.length * 7.2} height={14} rx={7} fill={paint.paper} stroke={colorOf(e.mediaId)} strokeWidth={1.5} />
            <text x={m.x} y={m.y + 4} textAnchor="middle" fontSize={10} fill={paint.ink}>{t}</text>
          </g>
        );
      })}
    </svg>
  );
}
