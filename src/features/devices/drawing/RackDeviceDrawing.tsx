import type { DeviceDefinition } from '../../../domain/device/types';
import { layoutFace, type FaceLayout } from './faceplateLayout';
import { PortGlyph } from './PortGlyph';
import { PsuGlyph } from './PsuGlyph';
import type { DrawingContext } from './types';
import { categoryPaint, paint } from '../../../theme/paint';

export interface DrawingSize {
  width: number;
  height: number;
}

function Face({ device, layout, ctx, y }: { device: DeviceDefinition; layout: FaceLayout; ctx: DrawingContext; y: number }) {
  const color = categoryPaint(device.category);
  return (
    <g transform={`translate(0 ${y})`}>
      <text x={0} y={-5} fontSize={11} fill={paint.inkMuted} fontWeight={600}>{layout.face.toUpperCase()}</text>
      <rect width={layout.width} height={layout.height} rx={4} fill="#1e293b" stroke={color} strokeWidth={2} />
      {layout.labels.map((l) => (
        <text key={l.group.id} x={l.x} y={l.y} fontSize={8} fill="#cbd5e1">{`${l.group.label} (${l.group.count})`}</text>
      ))}
      {layout.ports.map((p) => <PortGlyph key={p.ref} box={p} ctx={ctx} />)}
      {layout.psus.map((b, i) => (
        <PsuGlyph key={i} box={b} index={i + 1} inlet={device.psus?.inlet ?? ''} ratedW={device.psus?.ratedW ?? 0} />
      ))}
      {layout.ports.length === 0 && layout.psus.length === 0 && (
        <text x={10} y={layout.height / 2 + 4} fontSize={10} fill="#94a3b8">empty</text>
      )}
    </g>
  );
}

/** Size of the rack-device drawing; both faces share the widest content width. */
export function rackDeviceLayouts(device: DeviceDefinition) {
  const width = Math.max(layoutFace(device, 'front').width, layoutFace(device, 'rear').width);
  return { front: layoutFace(device, 'front', width), rear: layoutFace(device, 'rear', width), width };
}

const GAP = 26;

export function rackDeviceSize(device: DeviceDefinition): DrawingSize {
  const { front, rear, width } = rackDeviceLayouts(device);
  return { width, height: 16 + front.height + GAP + rear.height };
}

/** Front and rear faceplates of a rack-mounted device. */
export function RackDeviceDrawing({ device, ctx }: { device: DeviceDefinition; ctx: DrawingContext }) {
  const { front, rear } = rackDeviceLayouts(device);
  return (
    <g>
      <Face device={device} layout={front} ctx={ctx} y={16} />
      <Face device={device} layout={rear} ctx={ctx} y={16 + front.height + GAP} />
    </g>
  );
}
