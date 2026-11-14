import type { PointerEvent } from 'react';
import type { DeviceDefinition } from '../../domain/device/types';
import type { Placement } from '../../domain/design/types';
import type { RackTemplate } from '../../domain/rack/types';
import { traitsOf } from '../../domain/device/categories';
import { unitsIn } from '../../domain/units';
import { bodyX, sideSlotRect, unitTopY, type RackGeometry } from '../../drawing/rackGeometry';

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
  if (p.mount.kind === 'side') return sideSlotRect(geo, p.mount.side, p.mount.slot);
  const units = Math.max(1, unitsIn(device.height, rack.unitSystem));
  const top = unitTopY(geo, rack, p.mount.position + units - 1);
  return { x: bodyX(geo), y: top, w: geo.bodyW, h: units * geo.unitPx };
}

/** A device instance drawn in the elevation. */
export function PlacedDevice({ placement, device, rack, geo, selected, ghost, dragging, onPointerDown }: Props) {
  const r = placementRect(placement, device, rack, geo);
  const color = traitsOf(device.category).color;
  const vertical = placement.mount.kind === 'side';
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return (
    <g onPointerDown={onPointerDown} style={{ cursor: 'grab' }} opacity={dragging ? 0.4 : 1}>
      <title>{`${placement.label} — ${device.name}`}</title>
      <rect x={r.x + 1} y={r.y + 1} width={r.w - 2} height={r.h - 2} rx={2}
        fill={color} fillOpacity={ghost ? 0.25 : 0.9}
        stroke={selected ? '#facc15' : '#0f172a'} strokeWidth={selected ? 3 : 1}
        strokeDasharray={ghost ? '4 2' : undefined} />
      <text x={cx} y={cy + 4} fontSize={vertical ? 9 : 10} textAnchor="middle" fill={ghost ? '#0f172a' : '#fff'}
        fontWeight={600} transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined} pointerEvents="none">
        {vertical ? placement.label : `${placement.label} · ${device.name}`}
      </text>
    </g>
  );
}
