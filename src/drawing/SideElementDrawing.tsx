import { SIDE_KINDS } from '../domain/rack/sideElements';
import { paint } from '../theme/paint';
import { sideSlotRect, type SideElementBox } from './rackGeometry';

interface Props {
  box: SideElementBox;
  selected?: boolean;
  onClick?(): void;
}

/** One side element: outline per kind, dashed empty slots, vertical name. */
export function SideElementDrawing({ box, selected, onClick }: Props) {
  const { element: e } = box;
  const traits = SIDE_KINDS[e.kind];
  const cx = box.x + box.w / 2;
  const hatchId = `hatch-${e.id}`;
  return (
    <g onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <title>{`${e.name} · ${traits.label} · ${e.widthMm}x${e.depthMm} mm · ${e.slots} slot(s)`}</title>
      {traits.hatched && (
        <defs>
          <pattern id={hatchId} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={8} stroke={paint.inkMuted} strokeWidth={1} strokeOpacity={0.5} />
          </pattern>
        </defs>
      )}
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={3}
        fill={traits.hatched ? `url(#${hatchId})` : paint.paper} fillOpacity={traits.hatched ? 1 : 0}
        stroke={selected ? paint.selection : paint.inkMuted} strokeWidth={selected ? 2.5 : 1.5}
        strokeDasharray={traits.dashed ? '6 4' : undefined} />
      {Array.from({ length: e.slots }, (_, i) => {
        const r = sideSlotRect(box, i + 1);
        return (
          <rect key={i} x={r.x} y={r.y + 1} width={r.w} height={r.h - 2} rx={2}
            fill={paint.slot} fillOpacity={0.6} stroke={paint.inkMuted} strokeOpacity={0.6} strokeDasharray="3 2" />
        );
      })}
      {/* Name sits above the box so devices in slots never cover it. */}
      <text x={cx} y={box.y - 4} fontSize={Math.min(9, Math.max(6, box.w / 6))} textAnchor="middle" fill={paint.inkMuted}
        pointerEvents="none">{e.name}</text>
    </g>
  );
}
