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
  const legs = c.breakout?.count ?? 1;
  const LEG_GAP = 66;
  const width = 40 + CONNECTOR_W * 2 + RUN;
  const height = Math.max(210, 110 + legs * LEG_GAP);
  const y = 80 + (legs * LEG_GAP) / 2;
  const left = 20;
  const right = left + CONNECTOR_W + RUN;
  const facts = [
    CABLE_TYPES[c.type] ?? c.type,
    isFiber(c.type) && c.fiberCount ? `${c.fiberCount} fibers` : '',
    c.maxLengthM ? `≤ ${c.maxLengthM} m` : '',
    c.breakout ? `breakout 1x ${c.connector} → ${c.breakout.count}x ${c.breakout.connector}` : '',
    [c.vendor, c.model].filter(Boolean).join(' '),
  ].filter(Boolean).join(' · ');
  return (
    <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width={width} className="drawing">
      <rect width={width} height={height} fill={paint.paper} />
      <text x={20} y={30} fontSize={20} fontWeight={700} fill={paint.ink}>{c.name}</text>
      <text x={20} y={52} fontSize={14} fill={paint.inkMuted}>{facts}</text>
      {Array.from({ length: legs }, (_, i) => {
        const ly = legs === 1 ? y : 80 + i * LEG_GAP + LEG_GAP / 2;
        const sx = left + CONNECTOR_W;
        // Straight cable = one line; breakout = trunk fanning out over the last third.
        const d = legs === 1 ? `M${sx},${y} L${right},${y}` : `M${sx},${y} L${sx + RUN * 0.55},${y} C${sx + RUN * 0.8},${y} ${right - RUN * 0.15},${ly} ${right},${ly}`;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="#0f172a" strokeWidth={10} />
            <path d={d} fill="none" stroke={c.color} strokeWidth={7} />
            <ConnectorGlyph x={right} y={ly - CONNECTOR_H / 2} label={c.breakout?.connector ?? c.connector} facing="left" />
          </g>
        );
      })}
      <ConnectorGlyph x={left} y={y - CONNECTOR_H / 2} label={c.connector} facing="right" />
    </svg>
  );
}
