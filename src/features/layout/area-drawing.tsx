import type { PointerEvent } from 'react';
import type { Rect } from '../../domain/layout/types';
import { paint } from '../../theme/paint';

interface Props {
  rect: Rect;
  fill: string;
  label: string;
  dashed?: boolean;
  /** Fill opacity; overhead trays use a lighter fill so the aisle stays visible below. */
  opacity?: number;
  selected: boolean;
  cursor?: string;
  /** Label position along the long side, 0..1 (default centre). */
  labelAt?: number;
  /**
   * Overhead elements (trays) lie on top of aisles: they are hit only on their outline and label,
   * so clicks inside them reach the aisle below.
   */
  overhead?: boolean;
  onPointerDown(e: PointerEvent<SVGElement>): void;
}

/** Labelled rectangle for aisles, trays and facilities; label runs along the long side. */
export function AreaDrawing({ rect, fill, label, dashed, opacity = 0.25, selected, cursor = 'move', labelAt = 0.5, overhead, onPointerDown }: Props) {
  const vertical = rect.depthMm > rect.widthMm;
  const short = Math.min(rect.widthMm, rect.depthMm);
  const cx = rect.x + rect.widthMm * (vertical ? 0.5 : labelAt);
  const cy = rect.y + rect.depthMm * (vertical ? labelAt : 0.5);
  return (
    <g onClick={(e) => e.stopPropagation()} onPointerDown={onPointerDown} style={{ cursor }}>
      <rect x={rect.x} y={rect.y} width={rect.widthMm} height={rect.depthMm} fill={fill} fillOpacity={opacity}
        stroke={selected ? paint.selection : fill} strokeWidth={selected ? 50 : 20} strokeDasharray={dashed ? '120 60' : undefined}
        pointerEvents={overhead ? 'none' : undefined} />
      {/* Overhead: a wide invisible outline to grab, the fill stays click-through. */}
      {overhead && <rect x={rect.x} y={rect.y} width={rect.widthMm} height={rect.depthMm} fill="none" stroke="transparent"
        strokeWidth={160} pointerEvents="stroke" />}
      <text x={cx} y={cy} fontSize={Math.min(220, short * 0.45)} textAnchor="middle" dominantBaseline="middle"
        fill={paint.ink} pointerEvents={overhead ? 'visiblePainted' : 'none'} transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined}>{label}</text>
    </g>
  );
}
