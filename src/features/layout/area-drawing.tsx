import type { PointerEvent } from 'react';
import type { Rect } from '../../domain/layout/types';
import { paint } from '../../theme/paint';

interface Props {
  rect: Rect;
  fill: string;
  label: string;
  dashed?: boolean;
  selected: boolean;
  onClick(): void;
  onPointerDown(e: PointerEvent<SVGElement>): void;
}

/** Labelled rectangle for aisles and cable trays; label runs along the long side. */
export function AreaDrawing({ rect, fill, label, dashed, selected, onClick, onPointerDown }: Props) {
  const vertical = rect.depthMm > rect.widthMm;
  const short = Math.min(rect.widthMm, rect.depthMm);
  const cx = rect.x + rect.widthMm / 2;
  const cy = rect.y + rect.depthMm / 2;
  return (
    <g onClick={(e) => { e.stopPropagation(); onClick(); }} onPointerDown={onPointerDown} style={{ cursor: 'move' }}>
      <rect x={rect.x} y={rect.y} width={rect.widthMm} height={rect.depthMm} fill={fill} fillOpacity={0.25}
        stroke={selected ? paint.selection : paint.inkMuted} strokeWidth={selected ? 50 : 15} strokeDasharray={dashed ? '120 60' : undefined} />
      <text x={cx} y={cy} fontSize={Math.min(220, short * 0.5)} textAnchor="middle" dominantBaseline="middle"
        fill={paint.ink} pointerEvents="none" transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined}>{label}</text>
    </g>
  );
}
