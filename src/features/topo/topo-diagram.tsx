import type { Ref } from 'react';
import { paint, LAYOUT_PAINT } from '../../theme/paint';
import { BOX_H, BOX_W, type TopoDiagram } from '../../domain/topo/diagram';
import type { VirtualTopo } from '../../domain/topo/virtual';

interface Props {
  topo: VirtualTopo;
  diagram: TopoDiagram;
  ref?: Ref<SVGSVGElement>;
}

const fmt = (n: number) => n.toLocaleString('en-US');

/** Virtual topology diagram: one box per device set group (role, count, partitions, ports), one line per link spec. */
export function TopoDiagramView({ topo, diagram, ref }: Props) {
  const linkByName = new Map(topo.links.map((l) => [l.name, l]));
  const rack = LAYOUT_PAINT.itRack;
  return (
    <svg ref={ref} viewBox={`0 0 ${diagram.width} ${diagram.height}`} width={diagram.width} className="drawing" fontSize={12}>
      <rect x={0} y={0} width={diagram.width} height={diagram.height} fill={paint.paper} />
      {diagram.links.map((p, i) => {
        const l = linkByName.get(p.name);
        const color = LAYOUT_PAINT.traces[i % LAYOUT_PAINT.traces.length];
        const label = l ? `${p.name}: ${l.pattern}${l.perPair > 1 ? ` x${l.perPair}` : ''}${l.links !== undefined ? ` · ${fmt(l.links)} links` : ''}` : p.name;
        return (
          <g key={`${p.name}-${i}`}>
            <polyline points={p.points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={paint.paper} strokeWidth={5} />
            <polyline points={p.points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={color} strokeWidth={2.2} />
            <g transform={`translate(${p.lx},${p.ly})`}>
              <rect x={p.self ? 0 : -label.length * 3.4 - 6} y={-10} width={label.length * 6.8 + 12} height={20} rx={10}
                fill={paint.paper} stroke={color} />
              <text x={p.self ? label.length * 3.4 + 6 : 0} y={4} textAnchor="middle" fill={paint.ink}>{label}</text>
              <title>{l ? linkTitle(l) : p.name}</title>
            </g>
          </g>
        );
      })}
      {diagram.boxes.map((b, i) => {
        const s = rack(i);
        const g = b.group;
        const parts = g.partitions.map((p) => (p.sizes ? `${p.key}: ${Object.entries(p.sizes).map(([k, v]) => `${k}=${v}`).join(' ')}` : `${p.key}: ${p.count} x ${p.size}`));
        const pools = Object.entries(g.pools).map(([k, n]) => `${k} ${n}`).join(' · ');
        return (
          <g key={g.name} transform={`translate(${b.x},${b.y})`}>
            <rect width={BOX_W} height={BOX_H} rx={8} fill={s.fill} stroke={s.stroke} strokeWidth={1.5} />
            <text x={12} y={22} fontSize={15} fontWeight={700} fill={s.text}>{g.name}</text>
            <text x={BOX_W - 12} y={22} textAnchor="end" fill={s.text}>{`${g.role} · ${fmt(g.count)}`}</text>
            {parts.slice(0, 3).map((t, k) => <text key={t} x={12} y={44 + k * 16} fill={s.text}>{t}</text>)}
            <text x={12} y={BOX_H - 10} fill={s.text} opacity={0.8}>{pools ? `ports: ${pools}` : 'no port pools'}</text>
          </g>
        );
      })}
    </svg>
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
