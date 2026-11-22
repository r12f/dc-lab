import type { Ref } from 'react';
import { paint, LAYOUT_PAINT } from '../../theme/paint';
import { CELL, type GroupBox, type PoolBitmap, type SetBox, type TopoDiagram } from '../../domain/topo/diagram';
import type { VirtualTopo } from '../../domain/topo/virtual';

interface Props {
  topo: VirtualTopo;
  diagram: TopoDiagram;
  ref?: Ref<SVGSVGElement>;
}

const fmt = (n: number) => n.toLocaleString('en-US');

/**
 * Virtual topology diagram as a slice: group boxes split by partition, a few devices per set (first, second, ...,
 * last), device-to-device lines per link spec, and each spec's rule beside its tier gap.
 */
export function TopoDiagramView({ topo, diagram, ref }: Props) {
  const color = (i: number) => LAYOUT_PAINT.traces[i % LAYOUT_PAINT.traces.length];
  return (
    <svg ref={ref} viewBox={`0 0 ${diagram.width} ${diagram.height}`} width={diagram.width} className="drawing" fontSize={12}>
      <rect x={0} y={0} width={diagram.width} height={diagram.height} fill={paint.paper} />
      {diagram.boxes.map((b, i) => <Group key={b.group.name} b={b} i={i} />)}
      {diagram.links.map((p, i) => (
        <line key={i} x1={p.points[0][0]} y1={p.points[0][1]} x2={p.points[1][0]} y2={p.points[1][1]} stroke={color(p.link)} strokeWidth={0.9} opacity={0.7} />
      ))}
      {diagram.labels.map((p) => {
        const l = topo.links[p.link];
        const rows = linkLines(l);
        return (
          <g key={p.link}>
            {rows.map((r, k) => (
              <text key={k} x={p.x} y={p.y - (rows.length - 1) * 8 + k * 16 + 4} textAnchor="end" fontWeight={k === 0 ? 700 : 400} fill={color(p.link)} stroke={paint.paper} strokeWidth={4} paintOrder="stroke">{r}</text>
            ))}
            <title>{linkTitle(l)}</title>
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
      <text x={12} y={20} fontSize={14} fontWeight={700} fill={s.text}>{`${g.name} · ${fmt(g.count)} ${g.role}`}</text>
      <text x={12} y={36} fill={s.text} opacity={0.85}>{`by ${b.caption}`}</text>
      {b.pools.map((q) => <Pool key={q.name} q={q} stroke={s.stroke} text={s.text} />)}
      <Level s={b.body} stroke={s.stroke} text={s.text} />
    </g>
  );
}

const PER_ROW = 128;

/** Port bitmap of a pool: one cell per port; taken ports filled in the color of the link spec using them. */
function Pool({ q, stroke, text }: { q: PoolBitmap; stroke: string; text: string }) {
  const owner: (number | undefined)[] = Array.from({ length: q.ports });
  for (const r of q.runs) for (let i = r.start; i < r.start + r.count; i++) owner[i] = r.link;
  // x of each port: slots add a gap; rows wrap every PER_ROW ports.
  const slotOf: number[] = [];
  q.slots.forEach((n, si) => { for (let i = 0; i < n; i++) slotOf.push(si); });
  const summary = `${q.name} · ${q.used}/${q.ports} used${q.slots.length > 1 ? ` · ${q.slots.length} slots x ${[...new Set(q.slots)].join('/')}` : ''}`
    + (q.runs.length > 1 ? ` (${q.runs.map((r) => `${r.name} ${r.count}`).join(', ')})` : '');
  return (
    <g transform={`translate(${q.x},${q.y})`}>
      <text x={0} y={10} fontSize={11} fill={text}>{summary}</text>
      {owner.map((l, i) => {
        const row = Math.floor(i / PER_ROW);
        const x = (i % PER_ROW) * CELL + 2 * (slotOf[i] ?? 0) - 2 * (slotOf[row * PER_ROW] ?? 0);
        return <rect key={i} x={x} y={14 + row * 8} width={CELL - 1} height={6}
          fill={l === undefined ? paint.paper : LAYOUT_PAINT.traces[l % LAYOUT_PAINT.traces.length]} stroke={l === undefined ? stroke : 'none'} strokeWidth={0.5} />;
      })}
      <title>{`${q.name}: ${q.ports} ports, ${q.used} used, ${q.ports - q.used} free${q.runs.map((r) => `\n${r.name}: ports ${r.start + 1}-${r.start + r.count}`).join('')}`}</title>
    </g>
  );
}

function Level({ s, stroke, text }: { s: SetBox; stroke: string; text: string }) {
  return (
    <g transform={`translate(${s.x},${s.y})`}>
      {s.label && <rect width={s.w} height={s.h} rx={5} fill={paint.paper} fillOpacity={0.55} stroke={stroke} />}
      {s.label && <text x={6} y={13} fontSize={11} fontWeight={600} fill={text}>{`${s.label} · ${s.sub}`}</text>}
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

/** Rule rows of a link spec: name and total; how instances pair, the pattern, devices per pair and ports per device. */
function linkLines(l: VirtualTopo['links'][number]): string[] {
  const kv = (k?: string) => (k ? [...k.matchAll(/\$\{([\w.]+)\}/g)].map((m) => m[1]).join('.') : '');
  const fk = kv(l.from.key); const tk = kv(l.to.key);
  const flt = (e: typeof l.from) => Object.entries(e.filters).map(([k, v]) => ` ${k} ${v}`).join('');
  const pairing = l.map.length
    ? `${l.fanIn} ${l.from.group} ${fk}s → 1 ${l.to.group} ${tk} (map)`
    : fk && tk ? `${l.from.group} ${fk} k → ${l.to.group} ${tk} k`
      : fk ? `each ${l.from.group} ${fk} → all ${l.to.group}${flt(l.to)}` : `all ${l.from.group}${flt(l.from)} → all ${l.to.group}${flt(l.to)}`;
  const shape = l.pattern === 'mesh'
    ? `mesh ${fmtD(l.fromSize)} x ${fmtD(l.toSize)} per pair`
    : `round-robin ${fmtD(l.fromSize)} over ${fmtD(l.toSize)}`;
  const ports = l.fromPorts !== undefined && l.toPorts !== undefined
    ? ` · each ${l.from.group} ${fmtD(l.fromPorts)} ${l.from.ports} · each ${l.to.group} ${fmtD(l.toPorts)} ${l.to.ports}` : '';
  return [`${l.name} · ${l.links !== undefined ? `${fmt(l.links)} links` : '? links'}`,
    `${pairing} · ${shape}${l.perPair > 1 ? ` x${l.perPair}` : ''}${ports}`];
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
