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
      {diagram.links.map((p, i) => <polyline key={`c${i}`} points={p.points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={paint.paper} strokeWidth={4} />)}
      {diagram.links.map((p, i) => <polyline key={`l${i}`} points={p.points.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={color(p.link)} strokeWidth={p.device ? 1 : 1.6} opacity={p.device ? 0.8 : 1} />)}
      {diagram.labels.map((p) => {
        const l = linkByName.get(p.name);
        const rows = l ? linkLines(l) : [p.name];
        const w = Math.max(...rows.map((r) => r.length)) * 6.6 + 16;
        const h = rows.length * 15 + 8;
        return (
          <g key={`t${p.link}`} transform={`translate(${p.x},${p.y})`}>
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={6} fill={paint.paper} stroke={color(p.link)} />
            {rows.map((r, k) => (
              <text key={k} x={0} y={-h / 2 + 16 + k * 15} textAnchor="middle" fontWeight={k === 0 ? 700 : 400} fill={paint.ink}>{r}</text>
            ))}
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
      {b.sets.map((t) => <SetView key={t.label} t={t} stroke={s.stroke} text={s.text} />)}
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

function SetView({ t, stroke, text }: { t: GroupBox['sets'][number]; stroke: string; text: string }) {
  const parent = t.children.length > 0;
  return (
    <g transform={`translate(${t.x},${t.y})`}>
      <rect width={t.w} height={t.h} rx={5} fill={paint.paper} fillOpacity={t.more ? 0.25 : parent ? 0.35 : 0.75} stroke={stroke}
        strokeDasharray={t.more ? '4 3' : undefined} />
      {parent ? (
        <text x={6} y={13} fontSize={11} fontWeight={600} fill={text}>{`${t.label} · ${t.sub}`}</text>
      ) : (
        <>
          <text x={t.w / 2} y={t.more ? t.h / 2 - 2 : 15} textAnchor="middle" fontWeight={600} fill={text}>{t.label}</text>
          {t.dots.map((d, k) => d.n === null
            ? <text key={k} x={d.x + 4.5} y={31} textAnchor="middle" fill={text}>…</text>
            : <rect key={k} x={d.x} y={22} width={9} height={11} rx={1.5} fill={stroke}><title>{`device ${d.n}`}</title></rect>)}
          <text x={t.w / 2} y={t.more ? t.h / 2 + 13 : 47} textAnchor="middle" fontSize={11} fill={text} opacity={0.85}>{t.sub}</text>
        </>
      )}
      {t.children.map((c) => <SetView key={c.label} t={c} stroke={stroke} text={text} />)}
      <title>{t.path.map(([k, v]) => `${k} ${v}`).join(' › ') || t.label}</title>
    </g>
  );
}

/** Label rows of a link spec: pattern and total; how instances pair up; per pair and per device numbers. */
function linkLines(l: VirtualTopo['links'][number]): string[] {
  const kv = (k?: string) => (k ? [...k.matchAll(/\$\{([\w.]+)\}/g)].map((m) => m[1]).join('.') : '');
  const fk = kv(l.from.key); const tk = kv(l.to.key);
  const flt = (e: typeof l.from) => Object.entries(e.filters).map(([k, v]) => ` ${k} ${v}`).join('');
  const pairing = l.map.length
    ? `${l.from.group} ${fk} → ${l.to.group} ${tk}: ${l.fanIn}:1 by map`
    : fk && tk ? `${l.from.group} ${fk} → ${l.to.group} ${tk}: 1:1 (same value)`
      : fk ? `each ${l.from.group} ${fk} → all ${l.to.group}${flt(l.to)}` : `all ${l.from.group}${flt(l.from)} → all ${l.to.group}${flt(l.to)}`;
  const shape = l.pattern === 'mesh'
    ? `mesh: ${fmtD(l.fromSize)} x ${fmtD(l.toSize)} dev per pair, each to each`
    : `round-robin: ${fmtD(l.fromSize)} dev over ${fmtD(l.toSize)}, each to the next`;
  const rows = [`${l.name} · ${l.links !== undefined ? `${fmt(l.links)} links` : '? links'}`, pairing,
    `${shape}${l.perPair > 1 ? `, x${l.perPair} per device pair` : ''}`];
  if (l.fromPorts !== undefined && l.toPorts !== undefined) rows.push(`ports/dev: ${l.from.group} ${l.from.ports} ${fmtD(l.fromPorts)} · ${l.to.group} ${l.to.ports} ${fmtD(l.toPorts)}`);
  return rows;
}

const fmtD = (n?: number) => (n === undefined ? '?' : Number.isInteger(n) ? fmt(n) : n.toFixed(1));

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
