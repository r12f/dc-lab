import { useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from 'react';
import { paint, LAYOUT_PAINT } from '../../theme/paint';
import { M, type DiagramView, type GroupBox, type PortGrid, type SetBox, type TopoDiagram } from '../../domain/topo/diagram';
import { ruleDetail, ruleText } from '../../domain/topo/rule';
import type { VirtualTopo } from '../../domain/topo/virtual';

interface Props {
  topo: VirtualTopo;
  diagram: TopoDiagram;
  /** Saved view the diagram was laid out with (moved and collapsed boxes). */
  view: DiagramView;
  /** A box was moved (on release) or folded. */
  onView(view: DiagramView): void;
  ref?: Ref<SVGSVGElement>;
}

/** Distance (px) from the pane edge at which a drag scrolls the pane. */
const EDGE = 32;

const linkColor = (i: number) => LAYOUT_PAINT.traces[i % LAYOUT_PAINT.traces.length];

/**
 * Virtual topology diagram as a slice: group boxes split by partition with their port grids, device-to-device
 * lines per link spec, and each spec's rule beside its tier gap.
 */
export function TopoDiagramView({ topo, diagram, view, onView, ref }: Props) {
  const svgEl = useRef<SVGSVGElement | null>(null);
  // The box being dragged and how far (drawing units); committed to the view on release.
  const [drag, setDrag] = useState<{ group: string; dx: number; dy: number }>();
  const setRef = (el: SVGSVGElement | null) => {
    svgEl.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as { current: SVGSVGElement | null }).current = el;
  };
  /** Drawing coordinates of a pointer (CSS zoom-safe via the screen CTM). */
  const toSvg = (e: { clientX: number; clientY: number }) => {
    const m = svgEl.current?.getScreenCTM();
    if (!m) return { x: e.clientX, y: e.clientY };
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  };
  const toggle = (group: string) => {
    const c = new Set(view.collapsed ?? []);
    if (c.has(group)) c.delete(group); else c.add(group);
    onView({ ...view, collapsed: [...c] });
  };
  /** Press on a box header: dragging moves the box; a press without a move does nothing (the ▾ button folds). */
  const startDrag = (b: GroupBox) => (ev: ReactPointerEvent) => {
    if (ev.button !== 0) return;
    ev.preventDefault();
    const start = toSvg(ev);
    const from = view.offsets?.[b.group.name] ?? { dx: 0, dy: 0 };
    let last = { dx: 0, dy: 0 };
    const pane = svgEl.current?.closest('.canvas-scroll');
    const move = (e: PointerEvent) => {
      // Near the pane's bottom / right edge, scroll it along so the box stays in view.
      if (pane) {
        const r = pane.getBoundingClientRect();
        if (e.clientY > r.bottom - EDGE) pane.scrollTop += EDGE / 2;
        if (e.clientX > r.right - EDGE) pane.scrollLeft += EDGE / 2;
      }
      const p = toSvg(e);
      last = { dx: p.x - start.x, dy: p.y - start.y };
      setDrag({ group: b.group.name, ...last });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDrag(undefined);
      if (Math.abs(last.dx) + Math.abs(last.dy) > 3) {
        onView({ ...view, offsets: { ...view.offsets, [b.group.name]: { dx: Math.round(from.dx + last.dx), dy: Math.round(from.dy + last.dy) } } });
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  // While dragging, the drawing grows with the box (right / down), so it is never clipped mid-drag.
  const moving = drag && diagram.boxes.find((b) => b.group.name === drag.group);
  const width = Math.max(diagram.width, moving ? moving.x + drag.dx + moving.w + M.pad : 0);
  const height = Math.max(diagram.height, moving ? moving.y + drag.dy + moving.h + M.pad : 0);
  return (
    <svg ref={setRef} viewBox={`0 0 ${width} ${height}`} width={width} className="drawing" fontSize={12}>
      <rect x={0} y={0} width={width} height={height} fill={paint.paper} />
      {diagram.boxes.map((b, i) => (
        <Group key={b.group.name} b={b} i={i} shift={drag?.group === b.group.name ? drag : undefined}
          onHeaderDown={startDrag(b)} onToggle={() => toggle(b.group.name)} />
      ))}
      {diagram.lines.map((p, i) => (
        <line key={i} x1={p.from[0]} y1={p.from[1]} x2={p.to[0]} y2={p.to[1]} stroke={linkColor(p.link)}
          strokeWidth={p.bundle ? 3 : 0.9} opacity={drag ? 0.25 : p.bundle ? 0.85 : 0.7} />
      ))}
      {diagram.rules.map((p) => {
        const l = topo.links[p.link];
        return (
          <g key={p.link}>
            {ruleText(l).map((r, k) => (
              <text key={k} x={p.x} y={p.y - 4 + k * 16} textAnchor="end" fontWeight={k === 0 ? 700 : 400} fill={linkColor(p.link)}
                stroke={paint.paper} strokeWidth={4} paintOrder="stroke">{r}</text>
            ))}
            <title>{ruleDetail(l)}</title>
          </g>
        );
      })}
    </svg>
  );
}

interface GroupProps {
  b: GroupBox;
  i: number;
  /** Live drag offset (the box's lines follow on release). */
  shift?: { dx: number; dy: number };
  onHeaderDown(e: ReactPointerEvent): void;
  onToggle(): void;
}

/** A group box: header (drag to move, ▾ / ▸ to collapse or expand), port grids and sets. */
function Group({ b, i, shift, onHeaderDown, onToggle }: GroupProps) {
  const s = LAYOUT_PAINT.itRack(i);
  const g = b.group;
  return (
    <g transform={`translate(${b.x + (shift?.dx ?? 0)},${b.y + (shift?.dy ?? 0)})`} opacity={shift ? 0.85 : 1}>
      <rect width={b.w} height={b.h} rx={8} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} />
      <rect width={b.w} height={M.head} rx={8} fill="transparent" style={{ cursor: shift ? 'grabbing' : 'grab' }} onPointerDown={onHeaderDown}>
        <title>Drag to move</title>
      </rect>
      <g style={{ cursor: 'pointer' }} onClick={onToggle} onPointerDown={(e) => e.stopPropagation()}>
        <rect x={6} y={6} width={18} height={18} rx={3} fill="transparent" />
        <text x={15} y={20} textAnchor="middle" fontSize={12} fill={s.text}>{b.collapsed ? '▸' : '▾'}</text>
        <title>{b.collapsed ? 'Expand' : 'Collapse'}</title>
      </g>
      <text x={28} y={20} fontSize={14} fontWeight={700} fill={s.text} pointerEvents="none">{`${g.name} · ${g.count.toLocaleString('en-US')} ${g.role}`}</text>
      <text x={28} y={36} fill={s.text} opacity={0.85} pointerEvents="none">{`by ${b.caption}`}</text>
      {b.grids.map((q) => <Grid key={q.side} q={q} stroke={s.stroke} text={s.text} />)}
      {!b.collapsed && <Level s={b.body} stroke={s.stroke} text={s.text} />}
    </g>
  );
}

/**
 * Port grid of one device: every port a cell (column = port number, row = lane). Ports of this edge's pools are
 * outlined, and filled in the color of the link spec using them; ports the other edge's pools use are grey.
 */
function Grid({ q, stroke, text }: { q: PortGrid; stroke: string; text: string }) {
  const { cell, head, left } = M.grid;
  const top = q.side === 'top';
  const summary = q.pools.map((p) => `${p.name} ${p.used}/${p.ports} used${p.slots > 1 ? ` · ${p.slots} slots` : ''}`).join('   ');
  // Top: summary, column numbers, cells. Bottom: cells, column numbers, summary.
  const cy = top ? head : 0;
  const numY = top ? head - 3 : q.rows.length * cell + 8;
  const sumY = top ? 9 : q.rows.length * cell + 20;
  const ticks = q.cols.map((c, i) => ({ c, i })).filter(({ i }) => i === 0 || (i + 1) % 8 === 0 || i === q.cols.length - 1);
  return (
    <g transform={`translate(${q.x},${q.y})`}>
      <text x={q.w / 2} y={sumY} textAnchor="middle" fontSize={11} fill={text}>{`${top ? '▲' : '▼'} ${summary}`}</text>
      {ticks.map(({ c, i }) => (
        <text key={c} x={left + i * cell + cell / 2} y={numY} textAnchor="middle" fontSize={7} fill={text} opacity={0.75}>{c.replace(/^\D+/, '')}</text>
      ))}
      {q.rows.length > 1 && q.rows.map((r, i) => (
        <text key={r} x={left - 3} y={cy + i * cell + cell - 1} textAnchor="end" fontSize={7} fill={text} opacity={0.75}>{r}</text>
      ))}
      <rect x={left} y={cy} width={q.cols.length * cell - 1} height={q.rows.length * cell - 1} fill={paint.paper} />
      {q.cells.map((c) => (
        <rect key={c.port} x={left + c.col * cell} y={cy + c.row * cell} width={cell - 1} height={cell - 1}
          fill={c.link !== undefined ? linkColor(c.link) : c.otherUsed ? paint.inkMuted : paint.paper}
          fillOpacity={c.otherUsed ? 0.55 : 1} stroke={c.pool || c.other ? stroke : 'none'} strokeWidth={0.5} strokeOpacity={c.pool ? 1 : 0.35}>
          <title>{`${c.port} · ${c.pool ? `${c.pool}${c.link === undefined ? ' · free' : ''}` : c.other ? `${c.other} (other edge${c.otherUsed ? '' : ', free'})` : 'not in a pool'}`}</title>
        </rect>
      ))}
    </g>
  );
}

function Level({ s, stroke, text }: { s: SetBox; stroke: string; text: string }) {
  return (
    <g transform={`translate(${s.x},${s.y})`}>
      {s.label && <rect width={s.w} height={s.h} rx={5} fill={paint.paper} fillOpacity={0.55} stroke={stroke} />}
      {s.label && <text x={6} y={13} fontSize={11} fontWeight={600} fill={text}>{s.label}</text>}
      {s.sets.map((c, k) => <Level key={k} s={c} stroke={stroke} text={text} />)}
      {s.devices.map((d, k) => (
        <g key={k} transform={`translate(${d.x},${d.y})`}>
          <rect width={d.w} height={d.h} rx={3} fill={paint.paper} stroke={stroke} />
          <text x={d.w / 2} y={14} textAnchor="middle" fontSize={11} fill={text}>{d.label}</text>
          <title>{d.title}</title>
        </g>
      ))}
      {s.ellipses.map((e, k) => <text key={`e${k}`} x={e.x} y={e.y} textAnchor="middle" fontSize={14} fill={text}>…</text>)}
    </g>
  );
}
