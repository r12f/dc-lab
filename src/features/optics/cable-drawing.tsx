import type { Ref } from 'react';
import type { CableMedia } from '../../domain/optics/types';
import { CABLE_TYPES, isFiber } from '../../domain/optics/cable-types';
import { describeEnd, fiberMap } from '../../domain/optics/fiber-map';
import { paint } from '../../theme/paint';
import { ConnectorGlyph, CONNECTOR_H, CONNECTOR_W } from './connector-glyph';

interface Props {
  ref?: Ref<SVGSVGElement>;
  cable: CableMedia;
}

const RUN = 460;
const GAP = 64;
const TOP = 90;

/**
 * A cable: A connectors on the left, B connectors on the right, one line per connected A-B pair labelled
 * with its fiber count (shuffles cross). Long ends (trunks) are drawn compressed beyond 8 connectors.
 */
export function CableDrawing({ ref, cable: c }: Props) {
  const fm = fiberMap(c);
  const shown = (n: number) => Math.min(n, 8);
  const na = shown(c.ends.a.count);
  const nb = shown(c.ends.b.count);
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
  const lines = fm.pairs.flatMap((row, i) => row.map((n, j) => ({ i, j, n }))).filter((p) => p.n > 0 && p.i < na && p.j < nb);
  // When every A-B pair carries the same fibers, one note replaces per-line labels (shuffles stay legible).
  const uniform = lines.every((l) => l.n === lines[0]?.n);
  const perPair = isFiber(c.type) && lines.length ? `${lines[0].n}F per A→B pair` : '';
  const unused = [fm.unusedA ? `${fm.unusedA}F unused on A` : '', fm.unusedB ? `${fm.unusedB}F unused on B` : ''].filter(Boolean).join(' · ');
  const more = (n: number) => (n > 8 ? `… ${n - 8} more` : '');
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
      {Array.from({ length: na }, (_, i) => (
        <ConnectorGlyph key={`a${i}`} x={left} y={yOf(i, na) - CONNECTOR_H / 2} label={`A${i + 1} ${c.ends.a.connector}`} facing="right" />
      ))}
      {Array.from({ length: nb }, (_, j) => (
        <ConnectorGlyph key={`b${j}`} x={right} y={yOf(j, nb) - CONNECTOR_H / 2} label={`B${j + 1} ${c.ends.b.connector}`} facing="left" />
      ))}
      <text x={left} y={height - 14} fontSize={12} fill={paint.inkMuted}>{[uniform ? perPair : '', more(c.ends.a.count) && `A ${more(c.ends.a.count)}`, more(c.ends.b.count) && `B ${more(c.ends.b.count)}`, unused].filter(Boolean).join(' · ')}</text>
    </svg>
  );
}
