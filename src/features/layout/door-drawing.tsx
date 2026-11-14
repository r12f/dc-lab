import type { PointerEvent } from 'react';
import type { DcLayout, Door } from '../../domain/layout/types';
import { doorSegment } from '../../domain/layout/doors';
import { paint } from '../../theme/paint';
import { useLabels } from './view-context';

const SWING_LABEL = { in: 'swings in', out: 'swings out', 'slide-left': 'slides left', 'slide-right': 'slides right' } as const;

interface Props {
  layout: DcLayout;
  door: Door;
  selected: boolean;
  onPointerDown(e: PointerEvent<SVGElement>): void;
}

/**
 * A door as an architectural symbol: a gap in the wall plus, by how it opens,
 * - swing in / out: the leaf drawn open at 90° to that side and its swing arc;
 * - slide left / right: the leaf drawn parallel to the wall just inside it, shifted off the opening, with an arrow.
 * An outside arrow and label mark it; the main entry is bolder and labelled "ENTRY".
 */
export function DoorDrawing({ layout, door, selected, onPointerDown }: Props) {
  const s = doorSegment(layout, door);
  const len = door.widthMm;
  const entry = door.kind === 'entry';
  const swing = door.swing ?? 'in';
  // Hinge at the segment start; the leaf opens to the inside (n) or outside (-n).
  const side = swing === 'out' ? -1 : 1;
  const hx = s.x1, hy = s.y1;
  const ex = s.x1 + side * s.nx * len, ey = s.y1 + side * s.ny * len;
  const baseSweep = (s.nx === 0 ? (s.ny > 0 ? 1 : 0) : (s.nx > 0 ? 0 : 1));
  const sweep = side > 0 ? baseSweep : 1 - baseSweep;
  // Sliding leaf: inside the wall, offset by its width along the wall towards the slide direction (left/right as seen from inside).
  const ux = (s.x2 - s.x1) / len, uy = (s.y2 - s.y1) / len;
  // Left / right as seen from inside the room facing the door (looking along -n; y down): right = (ny, -nx).
  const toRight = Math.sign(ux * s.ny - uy * s.nx) || 1;
  const dirSign = swing === 'slide-right' ? toRight : -toRight;
  const slide = swing === 'slide-left' || swing === 'slide-right';
  const inset = 120;
  const sx1 = s.x1 + s.nx * inset + ux * dirSign * len * 0.5, sy1 = s.y1 + s.ny * inset + uy * dirSign * len * 0.5;
  const sx2 = sx1 + ux * len, sy2 = sy1 + uy * len;
  const mx = (s.x1 + s.x2) / 2 + s.nx * inset * 2.5, my = (s.y1 + s.y2) / 2 + s.ny * inset * 2.5;
  const ink = selected ? paint.selection : paint.ink;
  const cx = (s.x1 + s.x2) / 2, cy = (s.y1 + s.y2) / 2;
  // Outside of the wall: label and an arrow pointing in.
  const ox = cx - s.nx * 700, oy = cy - s.ny * 700;
  const vertical = s.nx !== 0;
  const { along } = useLabels();
  const lx = ox - s.nx * 230;
  const ly = oy - s.ny * 230;
  const label = entry ? (/^entry$/i.test(door.name) ? 'ENTRY' : `ENTRY · ${door.name}`) : door.name;
  return (
    <g style={{ cursor: 'move' }} onPointerDown={onPointerDown} onClick={(e) => e.stopPropagation()}>
      <title>{`${door.name} — ${door.wall} wall, ${door.widthMm} mm, ${SWING_LABEL[swing]}`}</title>
      {/* Wide invisible hit area along the opening. */}
      <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="transparent" strokeWidth={600} />
      {/* Gap in the wall */}
      <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={paint.paper} strokeWidth={60} />
      {slide ? (
        <>
          <line x1={sx1} y1={sy1} x2={sx2} y2={sy2} stroke={ink} strokeWidth={entry ? 70 : 50} />
          <line x1={mx - ux * dirSign * len * 0.3} y1={my - uy * dirSign * len * 0.3} x2={mx + ux * dirSign * len * 0.3} y2={my + uy * dirSign * len * 0.3}
            stroke={ink} strokeWidth={25} markerEnd="url(#door-arrow)" />
        </>
      ) : (
        <>
          <line x1={hx} y1={hy} x2={ex} y2={ey} stroke={ink} strokeWidth={entry ? 50 : 30} />
          <path d={`M${ex},${ey} A${len},${len} 0 0 ${sweep} ${s.x2},${s.y2}`} fill="none" stroke={ink} strokeWidth={20} strokeDasharray="80 60" />
        </>
      )}
      <line x1={ox} y1={oy} x2={cx - s.nx * 150} y2={cy - s.ny * 150} stroke={ink} strokeWidth={entry ? 60 : 35} markerEnd="url(#door-arrow)" />
      {/* Label outside the wall, beyond the arrow; along the wall on east/west walls so it stays within the margin. */}
      <text x={lx} y={ly} fontSize={entry ? 220 : 170} fontWeight={entry ? 800 : 600} textAnchor="middle" dominantBaseline="middle" fill={ink}
        transform={along(lx, ly, vertical ? (s.nx > 0 ? -90 : 90) : 0)}>
        {label}
      </text>
    </g>
  );
}

/** Arrowhead used by door arrows (defs, rendered once). */
export function DoorArrowDefs() {
  return (
    <defs>
      <marker id="door-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill={paint.ink} />
      </marker>
    </defs>
  );
}
