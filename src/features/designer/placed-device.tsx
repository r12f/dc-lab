import type { PointerEvent } from 'react';
import type { DeviceDefinition } from '../../domain/device/types';
import type { Placement } from '../../domain/design/types';
import type { RackTemplate } from '../../domain/rack/types';
import { unitsIn } from '../../domain/units';
import { bodyX, sideBox, sideSlotRect, unitTopY, type RackGeometry } from '../../drawing/rack-geometry';
import { categoryPaint, paint } from '../../theme/paint';
import { traitsOf } from '../../domain/device/categories';

/** Blanking panels are dark, stiffeners steel grey; both visually recede behind active devices. */
const FILLER_FILL = { blanking: '#1f2937', stiffener: '#64748b', reserved: 'none' } as const;

interface Props {
  placement: Placement;
  device: DeviceDefinition;
  rack: RackTemplate;
  geo: RackGeometry;
  selected: boolean;
  /** Full-depth device mounted from the other face. */
  ghost: boolean;
  dragging: boolean;
  onPointerDown(e: PointerEvent<SVGGElement>): void;
}

export function placementRect(p: Placement, device: DeviceDefinition, rack: RackTemplate, geo: RackGeometry) {
  if (p.mount.kind === 'side') {
    const box = sideBox(geo, p.mount.elementId);
    return box ? sideSlotRect(box, p.mount.slot) : { x: 0, y: 0, w: 0, h: 0 };
  }
  const units = Math.max(1, unitsIn(device.height, rack.unitSystem));
  const top = unitTopY(geo, rack, p.mount.position + units - 1);
  return { x: bodyX(geo), y: top, w: geo.bodyW, h: units * geo.unitPx };
}

/** A device instance drawn in the elevation. */
export function PlacedDevice({ placement, device, rack, geo, selected, ghost, dragging, onPointerDown }: Props) {
  const r = placementRect(placement, device, rack, geo);
  const filler = traitsOf(device.category).filler;
  const color = filler ? FILLER_FILL[filler] : categoryPaint(device.category);
  const reserved = filler === 'reserved';
  const vertical = placement.mount.kind === 'side';
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return (
    <g onPointerDown={onPointerDown} style={{ cursor: 'grab' }} opacity={dragging ? 0.4 : 1}>
      <title>{`${placement.label} — ${device.name}`}</title>
      {/* Reserved space: dashed outline on the empty slot fill, so it reads as "kept empty", not as a device. */}
      <rect x={r.x + 1} y={r.y + 1} width={r.w - 2} height={r.h - 2} rx={2}
        fill={reserved ? paint.slot : color} fillOpacity={ghost ? 0.25 : reserved ? 1 : 0.9}
        stroke={selected ? paint.selection : reserved ? paint.inkMuted : paint.ink} strokeWidth={selected ? 3 : reserved ? 1.5 : 1}
        strokeDasharray={ghost || reserved ? '4 2' : undefined} />
      <text x={cx} y={cy + 4} fontSize={vertical ? 9 : 10} textAnchor="middle" fill={ghost || reserved ? paint.inkMuted : '#F8FAFC'}
        fontWeight={600} transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined} pointerEvents="none">
        {vertical ? placement.label : `${placement.label} · ${device.name}`}
      </text>
    </g>
  );
}
