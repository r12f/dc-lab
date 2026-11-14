import type { Rect } from '../../domain/layout/types';

interface Props {
  rect: Rect;
  fill: string;
  label: string;
  dashed?: boolean;
  selected: boolean;
  onClick(): void;
}

/** Labelled rectangle for aisles and cable trays. */
export function AreaDrawing({ rect, fill, label, dashed, selected, onClick }: Props) {
  return (
    <g onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ cursor: 'pointer' }}>
      <rect x={rect.x} y={rect.y} width={rect.widthMm} height={rect.depthMm} fill={fill} fillOpacity={0.6}
        stroke={selected ? '#ca8a04' : '#64748b'} strokeWidth={selected ? 50 : 15} strokeDasharray={dashed ? '120 60' : undefined} />
      <text x={rect.x + 100} y={rect.y + Math.min(rect.depthMm, 600) / 2 + 60} fontSize={Math.min(180, rect.depthMm * 0.6)}
        fill="#334155" pointerEvents="none">{label}</text>
    </g>
  );
}
