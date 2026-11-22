import type { Ref } from 'react';
import { paint, LAYOUT_PAINT } from '../../theme/paint';
import { CELL_W, type GroupBox, type TopoDiagram } from '../../domain/topo/diagram';
import type { VirtualTopo } from '../../domain/topo/virtual';

interface Props {
  topo: VirtualTopo;
  diagram: TopoDiagram;
  ref?: Ref<SVGSVGElement>;
}

const fmt = (n: number) => n.toLocaleString('en-US');

/**
 * Virtual topology diagram: one box per device set group (header, its sets for the chosen partition, its port
 * pools on the edges), one line per link spec ending on the pools it uses.
 */
export function TopoDiagramView({ topo, diagram, ref }: Props) {
  const linkByName = new Map(topo.links.map((l) => [l.name, l]));
  const color = (i: number) => LAYOUT_PAINT.traces[i % LAYOUT_PAINT.traces.length];
  return (
    <svg ref={ref} viewBox={`0 0 ${diagram.width} ${diagram.height}`} width={diagram.width} className="drawing" fontSize={12}>
      <rect x={0} y={0} width={diagram.width} height={diagram.height} fill={paint.paper} />
      {diagram.boxes.map((b, i) => <Group key={b.group.name} b={b} i={i} />)}
      {/* All casings, then all lines, then labels: later lines never cut earlier ones. */}
      {diagram.links.map((p, i) => <polyline key={`c${i}`} points={p.points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={paint.paper} strokeWidth={5} />)}
      {diagram.links.map((p, i) => <polyline key={`l${i}`} points={p.points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={color(i)} strokeWidth={2.2} />)}
      {diagram.links.map((p, i) => {
        const l = linkByName.get(p.name);
        const label = l ? `${p.name}: ${l.pattern}${l.perPair > 1 ? ` x${l.perPair}` : ''}${l.links !== undefined ? ` · ${fmt(l.links)} links` : ''}` : p.name;
        const w = label.length * 6.8 + 12;
        return (
          <g key={`t${i}`} transform={`translate(${p.lx},${p.ly})`}>
            <rect x={p.self ? 0 : -w / 2} y={-10} width={w} height={20} rx={10} fill={paint.paper} stroke={color(i)} />
            <text x={p.self ? w / 2 : 0} y={4} textAnchor="middle" fill={paint.ink}>{label}</text>
            <title>{l ? linkTitle(l) : p.name}</title>
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
      <text x={12} y={20} fontSize={15} fontWeight={700} fill={s.text}>{g.name}</text>
      <text x={b.w - 12} y={20} textAnchor="end" fill={s.text}>{`${g.role} · ${fmt(g.count)}`}</text>
      {b.caption && <text x={12} y={b.sets[0].y - 6} fill={s.text} opacity={0.85}>{b.caption}</text>}
      {b.sets.map((t) => (
        <g key={t.label} transform={`translate(${t.x},${t.y})`}>
          <rect width={t.w} height={t.h} rx={5} fill={paint.paper} fillOpacity={t.more ? 0.35 : 0.7} stroke={s.stroke}
            strokeDasharray={t.more ? '4 3' : undefined} />
          <text x={t.w / 2} y={19} textAnchor="middle" fontWeight={600} fill={s.text}>{t.label}</text>
          <text x={t.w / 2} y={35} textAnchor="middle" fontSize={11} fill={s.text} opacity={0.85}>{t.sub}</text>
        </g>
      ))}
      {b.lines.map((t, k) => <text key={t} x={12} y={b.linesY + 8 + k * 16} fill={s.text}>{t}</text>)}
      {!b.sets.length && !b.lines.length && <text x={12} y={b.linesY + 8} fill={s.text} opacity={0.7}>no partitions</text>}
      {b.pools.map((q) => {
        const cells: { x: number; k: number }[] = [];
        let cx = 8; let k = 0;
        for (const n of q.slots) {
          const m = Math.min(n, q.cells - k);
          for (let j = 0; j < m; j++, k++) cells.push({ x: cx + j * CELL_W, k });
          cx += m * CELL_W + 2;
        }
        const top = q.side === 'top';
        return (
          <g key={q.name} transform={`translate(${q.x},${q.y})`}>
            <rect width={q.w} height={q.h} rx={4} fill={paint.paper} stroke={s.stroke} />
            {cells.map((c) => <rect key={c.k} x={c.x} y={top ? 3 : q.h - 9} width={CELL_W - 1} height={6} fill={s.stroke} />)}
            <text x={q.w / 2} y={top ? q.h - 5 : 13} textAnchor="middle" fontSize={11} fill={s.text}>
              {`${q.name} ${q.ports}${q.slots.length > 1 ? ` · ${q.slots.length} slots` : ''}${q.ports > q.cells ? ' …' : ''}`}
            </text>
            <title>{`${q.name}: ${q.ports} ports${q.slots.length > 1 ? `, ${q.slots.length} slots (${q.slots.join(', ')})` : ''}`}</title>
          </g>
        );
      })}
    </g>
  );
}

function linkTitle(l: VirtualTopo['links'][number]): string {
  const end = (e: typeof l.from) => `${e.group}${e.key ? ` by ${e.key}` : ''}${Object.keys(e.filters).length ? ` where ${Object.entries(e.filters).map(([k, v]) => `${k}=${v}`).join(', ')}` : ''} [${e.ports}]`;
  return [
    `${l.name}: ${l.pattern}, ${l.perPair} per pair`,
    `from ${end(l.from)}`,
    `to ${end(l.to)}`,
    ...(l.map.length ? [`map: ${l.map.map((m) => `${m.from.join('+')}→${m.to}`).join(', ')}`] : []),
    ...(l.links !== undefined ? [`${l.links.toLocaleString('en-US')} links`] : []),
  ].join('\n');
}
