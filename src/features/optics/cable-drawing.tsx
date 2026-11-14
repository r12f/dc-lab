import type { Ref } from 'react';
import type { CableMedia } from '../../domain/optics/types';
import { CABLE_TYPES, isFiber } from '../../domain/optics/cable-types';
import { describeEnd, fiberMap } from '../../domain/optics/fiber-map';
import { genderedConnector } from '../../domain/optics/connectors';
import { paint } from '../../theme/paint';
import { ConnectorGlyph, CONNECTOR_H, CONNECTOR_W } from './connector-glyph';
import { connectorSlots, type ConnectorSlot } from '../../domain/optics/connector-slots';

/** Elided middle of a long end: vertical dots and how many connectors they stand for. */
function Gap({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <text x={x + CONNECTOR_W / 2} y={y - 2} fontSize={22} fontWeight={700} textAnchor="middle" fill={paint.inkMuted}>⋮</text>
      <text x={x + CONNECTOR_W / 2} y={y + 16} fontSize={11} textAnchor="middle" fill={paint.inkMuted}>{`${n} more`}</text>
    </g>
  );
}

interface Props {
  ref?: Ref<SVGSVGElement>;
  cable: CableMedia;
}

const RUN = 460;
const GAP = 64;
const TOP = 90;

/**
 * A cable: A connectors on the left, B connectors on the right, one line per connected A-B pair labelled
 * with its fiber count (shuffles cross). Long ends (trunks) show their first and last connectors with
 * the middle elided ("⋮ 12 more"), so the last connector number is always visible.
 */
export function CableDrawing({ ref, cable: c }: Props) {
  const fm = fiberMap(c);
  const slotsA = connectorSlots(c.ends.a.count);
  const slotsB = connectorSlots(c.ends.b.count);
  const na = slotsA.length;
  const nb = slotsB.length;
  // Row of a connector index on its end (undefined when elided).
  const rowOf = (slots: ConnectorSlot[], idx: number) => { const r = slots.indexOf(idx); return r < 0 ? undefined : r; };
  const rows = Math.max(na, nb);
  const height = TOP + rows * GAP + 70;
  const width = 40 + CONNECTOR_W * 2 + RUN;
  const left = 20;
  const right = left + CONNECTOR_W + RUN;
  const yOf = (i: number, n: number) => TOP + (rows * GAP) / 2 + (i - (n - 1) / 2) * GAP;
  const facts = [
    CABLE_TYPES[c.type] ?? c.type,
    isFiber(c.type) && c.fiberCount ? `${c.fiberCount}F cable` : '',
    `A ${describeEnd(c.ends.a)} → B ${describeEnd(c.ends.b)}`,
    c.mapping,
    c.polarity ? `polarity ${c.polarity}` : '',
  ].filter(Boolean).join(' · ');
  const lines = fm.pairs
    .flatMap((row, a) => row.map((n, b) => ({ i: rowOf(slotsA, a), j: rowOf(slotsB, b), n })))
    .filter((p): p is { i: number; j: number; n: number } => p.n > 0 && p.i !== undefined && p.j !== undefined);
  // When every A-B pair carries the same fibers, one note replaces per-line labels (shuffles stay legible).
  const uniform = lines.every((l) => l.n === lines[0]?.n);
  const perPair = isFiber(c.type) && lines.length ? `${lines[0].n}F per A→B pair` : '';
  const unused = [fm.unusedA ? `${fm.unusedA}F unused on A` : '', fm.unusedB ? `${fm.unusedB}F unused on B` : ''].filter(Boolean).join(' · ');
  return (
    <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width={width} className="drawing">
      <rect width={width} height={height} fill={paint.paper} />
      <text x={20} y={30} fontSize={20} fontWeight={700} fill={paint.ink}>{c.name}</text>
      <text x={20} y={52} fontSize={13} fill={paint.inkMuted}>{facts}</text>
      {lines.map(({ i, j, n }) => {
        const y1 = yOf(i, na);
        const y2 = yOf(j, nb);
        const x1 = left + CONNECTOR_W;
        const d = `M${x1},${y1} C${x1 + RUN * 0.45},${y1} ${right - RUN * 0.45},${y2} ${right},${y2}`;
        return (
          <g key={`${i}-${j}`}>
            <path d={d} fill="none" stroke="#0f172a" strokeWidth={6} />
            <path d={d} fill="none" stroke={c.color} strokeWidth={4} />
            {isFiber(c.type) && !uniform && (
              <text x={(x1 + right) / 2} y={(y1 + y2) / 2 - 6} fontSize={11} textAnchor="middle" fill={paint.ink}>{`${n}F`}</text>
            )}
          </g>
        );
      })}
      {slotsA.map((s, r) => (typeof s === 'number'
        ? <ConnectorGlyph key={`a${r}`} x={left} y={yOf(r, na) - CONNECTOR_H / 2} label={`A${s + 1} ${genderedConnector(c.ends.a.connector, c.ends.a.gender)}`} facing="right" />
        : <Gap key={`a${r}`} x={left} y={yOf(r, na)} n={s.gap} />))}
      {slotsB.map((s, r) => (typeof s === 'number'
        ? <ConnectorGlyph key={`b${r}`} x={right} y={yOf(r, nb) - CONNECTOR_H / 2} label={`B${s + 1} ${genderedConnector(c.ends.b.connector, c.ends.b.gender)}`} facing="left" />
        : <Gap key={`b${r}`} x={right} y={yOf(r, nb)} n={s.gap} />))}
      <text x={left} y={height - 14} fontSize={12} fill={paint.inkMuted}>{[uniform ? perPair : '', unused].filter(Boolean).join(' · ')}</text>
    </svg>
  );
}
