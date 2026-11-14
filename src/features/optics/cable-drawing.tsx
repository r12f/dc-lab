import type { Ref } from 'react';
import type { CableMedia } from '../../domain/optics/types';
import { CABLE_TYPES, isFiber } from '../../domain/optics/cable-types';
import { paint } from '../../theme/paint';
import { ConnectorGlyph, CONNECTOR_H, CONNECTOR_W } from './connector-glyph';

interface Props {
  ref?: Ref<SVGSVGElement>;
  cable: CableMedia;
}

const RUN = 420;

/** A cable: two connector ends joined by the cable in its media color. */
export function CableDrawing({ ref, cable: c }: Props) {
  const width = 40 + CONNECTOR_W * 2 + RUN;
  const height = 210;
  const y = 110;
  const left = 20;
  const right = left + CONNECTOR_W + RUN;
  const facts = [
    CABLE_TYPES[c.type] ?? c.type,
    isFiber(c.type) && c.fiberCount ? `${c.fiberCount} fibers` : '',
    c.maxLengthM ? `≤ ${c.maxLengthM} m` : '',
    [c.vendor, c.model].filter(Boolean).join(' '),
  ].filter(Boolean).join(' · ');
  return (
    <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width={width} className="drawing">
      <rect width={width} height={height} fill={paint.paper} />
      <text x={20} y={30} fontSize={20} fontWeight={700} fill={paint.ink}>{c.name}</text>
      <text x={20} y={52} fontSize={14} fill={paint.inkMuted}>{facts}</text>
      <line x1={left + CONNECTOR_W} y1={y} x2={right} y2={y} stroke="#0f172a" strokeWidth={10} />
      <line x1={left + CONNECTOR_W} y1={y} x2={right} y2={y} stroke={c.color} strokeWidth={7} />
      <ConnectorGlyph x={left} y={y - CONNECTOR_H / 2} label={c.connector} facing="right" />
      <ConnectorGlyph x={right} y={y - CONNECTOR_H / 2} label={c.connector} facing="left" />
    </svg>
  );
}
