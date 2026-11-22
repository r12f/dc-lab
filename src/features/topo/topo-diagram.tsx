import type { Ref } from 'react';
import { paint, LAYOUT_PAINT } from '../../theme/paint';
import { M, type GroupBox, type PortGrid, type SetBox, type TopoDiagram } from '../../domain/topo/diagram';
import { ruleDetail, ruleText } from '../../domain/topo/rule';
import type { VirtualTopo } from '../../domain/topo/virtual';

interface Props {
  topo: VirtualTopo;
  diagram: TopoDiagram;
  ref?: Ref<SVGSVGElement>;
}

const linkColor = (i: number) => LAYOUT_PAINT.traces[i % LAYOUT_PAINT.traces.length];

/**
 * Virtual topology diagram as a slice: group boxes split by partition with their port grids, device-to-device
 * lines per link spec, and each spec's rule beside its tier gap.
 */
export function TopoDiagramView({ topo, diagram, ref }: Props) {
  return (
    <svg ref={ref} viewBox={`0 0 ${diagram.width} ${diagram.height}`} width={diagram.width} className="drawing" fontSize={12}>
      <rect x={0} y={0} width={diagram.width} height={diagram.height} fill={paint.paper} />
      {diagram.boxes.map((b, i) => <Group key={b.group.name} b={b} i={i} />)}
      {diagram.lines.map((p, i) => (
        <line key={i} x1={p.from[0]} y1={p.from[1]} x2={p.to[0]} y2={p.to[1]} stroke={linkColor(p.link)} strokeWidth={0.9} opacity={0.7} />
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

function Group({ b, i }: { b: GroupBox; i: number }) {
  const s = LAYOUT_PAINT.itRack(i);
  const g = b.group;
  return (
    <g transform={`translate(${b.x},${b.y})`}>
      <rect width={b.w} height={b.h} rx={8} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} />
      <text x={12} y={20} fontSize={14} fontWeight={700} fill={s.text}>{`${g.name} · ${g.count.toLocaleString('en-US')} ${g.role}`}</text>
      <text x={12} y={36} fill={s.text} opacity={0.85}>{`by ${b.caption}`}</text>
      {b.grids.map((q) => <Grid key={q.side} q={q} stroke={s.stroke} text={s.text} />)}
      <Level s={b.body} stroke={s.stroke} text={s.text} />
    </g>
  );
}

/**
 * Port grid of one device: every port a cell (column = port number, row = lane). Ports of this edge's pools are
 * outlined, and filled in the color of the link spec using them; ports of the other edge's pools are grey.
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
      {q.cells.map((c) => (
        <rect key={c.port} x={left + c.col * cell} y={cy + c.row * cell} width={cell - 1} height={cell - 1}
          fill={c.link !== undefined ? linkColor(c.link) : c.other ? stroke : paint.paper}
          fillOpacity={c.other ? 0.25 : 1} stroke={c.pool ? stroke : 'none'} strokeWidth={0.5}>
          <title>{`${c.port} · ${c.pool ? `${c.pool}${c.link === undefined ? ' · free' : ''}` : c.other ? `${c.other} (other edge)` : 'not in a pool'}`}</title>
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
