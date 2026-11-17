import { acceptsLabel, FACE_LABELS } from '../domain/rack/side-elements';
import { paint, RACK_FRAME } from '../theme/paint';
import { sideSlotRect, type SideElementBox } from './rack-geometry';

interface Props {
  box: SideElementBox;
  selected?: boolean;
  onClick?(): void;
}

/** One side element: outline per kind, dashed empty slots, vertical name. */
export function SideElementDrawing({ box, selected, onClick }: Props) {
  const { element: e } = box;
  // Holds nothing (cable manager, side panel): hatched; takes any device (sidepod): dashed.
  const traits = { hatched: e.accepts?.length === 0, dashed: !e.accepts };
  const cx = box.x + box.w / 2;
  const hatchId = `hatch-${e.id}`;
  return (
    <g onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <title>{`${e.name} · ${e.widthMm}x${e.depthMm} mm · ${e.slots} slot(s) · takes ${acceptsLabel(e)} · ${FACE_LABELS[e.faces]}${e.inside ? ' · inside the rack' : ''}`}</title>
      {traits.hatched && (
        <defs>
          <pattern id={hatchId} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1={0} y1={0} x2={0} y2={8} stroke={RACK_FRAME.sideLine} strokeWidth={1} strokeOpacity={0.7} />
          </pattern>
        </defs>
      )}
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={3}
        fill={traits.hatched ? `url(#${hatchId})` : RACK_FRAME.side}
        stroke={selected ? paint.selection : RACK_FRAME.sideLine} strokeWidth={selected ? 2.5 : 1.4}
        strokeDasharray={traits.dashed ? '6 4' : undefined} />
      {Array.from({ length: e.slots }, (_, i) => {
        const r = sideSlotRect(box, i + 1);
        return (
          <rect key={i} x={r.x} y={r.y + 1} width={r.w} height={r.h - 2} rx={2}
            fill={RACK_FRAME.sideSlot} stroke={RACK_FRAME.sideLine} strokeOpacity={0.8} strokeDasharray="3 2" />
        );
      })}
      {/* Name sits above the box so devices in slots never cover it. */}
      <text x={cx} y={box.y - 4} fontSize={Math.min(9, Math.max(6, box.w / 6))} textAnchor="middle" fill={RACK_FRAME.sideText}
        pointerEvents="none">{e.name}</text>
    </g>
  );
}
