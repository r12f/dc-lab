import { useState, type DragEvent, type PointerEvent, type Ref } from 'react';
import type { Library } from '../../domain/library/Library';
import type { Mount, RackDesign } from '../../domain/design/types';
import type { PortFace } from '../../domain/device/types';
import { computeRackMetrics } from '../../domain/design/metrics';
import { isFullDepth } from '../../domain/design/placement';
import { formatPower, formatWeight } from '../../domain/units';
import { RackFrame } from '../../drawing/RackFrame';
import { rackGeometry, unitTopY } from '../../drawing/rackGeometry';
import { toSvgPoint } from '../../io/svgPoint';
import { DEVICE_DRAG_TYPE } from './DevicePalette';
import { PlacedDevice, placementRect } from './PlacedDevice';
import { mountAt } from './mountAt';
import { paint } from '../../theme/paint';
import { routeCables } from './cableRoutes';
import { CableRoutesDrawing } from './CableRoutesDrawing';

interface Props {
  ref?: Ref<SVGSVGElement>;
  lib: Library;
  design: RackDesign;
  face: PortFace;
  selectedId?: string;
  onSelect(id: string | undefined): void;
  selectedCableId?: string;
  onSelectCable(id: string | undefined): void;
  onDropDevice(deviceId: string, mount: Mount): void;
  onMove(placementId: string, mount: Mount): void;
}

interface DragState {
  id: string;
  /** Offset from pointer to the device's top edge, in SVG units. */
  dy: number;
  /** Current pointer-derived top y. */
  y: number;
  x: number;
  moved: boolean;
}

/**
 * Rack elevation canvas. Palette devices are dropped via HTML drag-and-drop;
 * placed devices are moved with pointer events (SVG has no native drag).
 */
export function RackElevation({ ref, lib, design, face, selectedId, onSelect, selectedCableId, onSelectCable, onDropDevice, onMove }: Props) {
  const [drag, setDrag] = useState<DragState>();
  const rack = lib.racks.get(design.templateId);
  if (!rack) return <p className="muted">Unknown rack template {design.templateId}</p>;
  const geo = rackGeometry(rack);
  const metrics = computeRackMetrics(lib, design);
  const visible = design.placements.filter((p) => {
    if (p.mount.kind === 'side' || p.mount.face === face) return true;
    const d = lib.devices.get(p.deviceId);
    return !!d && isFullDepth(d, rack);
  });

  const svgPoint = (e: { currentTarget: Element; clientX: number; clientY: number }) =>
    toSvgPoint((e.currentTarget as Element).closest('svg') as SVGSVGElement, e.clientX, e.clientY);

  const onDrop = (e: DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    const deviceId = e.dataTransfer.getData(DEVICE_DRAG_TYPE);
    if (!deviceId) return;
    const pt = svgPoint(e);
    onDropDevice(deviceId, mountAt(geo, rack, face, pt.x, pt.y));
  };

  const startDrag = (id: string) => (e: PointerEvent<SVGGElement>) => {
    e.stopPropagation();
    onSelect(id);
    const p = design.placements.find((x) => x.id === id);
    const d = p && lib.devices.get(p.deviceId);
    if (!p || !d) return;
    const pt = svgPoint(e);
    const r = placementRect(p, d, rack, geo);
    (e.currentTarget.closest('svg') as SVGSVGElement).setPointerCapture(e.pointerId);
    setDrag({ id, dy: pt.y - r.y, y: r.y, x: pt.x, moved: false });
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const pt = svgPoint(e);
    setDrag({ ...drag, x: pt.x, y: pt.y - drag.dy, moved: true });
  };

  /** Mount for the current drag: bottom unit under the device's bottom edge. */
  const dragMount = (): Mount | undefined => {
    if (!drag) return undefined;
    const p = design.placements.find((x) => x.id === drag.id);
    const d = p && lib.devices.get(p.deviceId);
    if (!p || !d) return undefined;
    const r = placementRect(p, d, rack, geo);
    const mount = mountAt(geo, rack, face, drag.x, drag.y + r.h - geo.unitPx / 2);
    return mount;
  };

  const onPointerUp = () => {
    const mount = dragMount();
    if (drag?.moved && mount) onMove(drag.id, mount);
    setDrag(undefined);
  };

  const preview = drag?.moved ? dragMount() : undefined;

  return (
    <svg
      ref={ref}
      viewBox={`-10 -10 ${geo.width + 20} ${geo.height + 20}`}
      width={(geo.width + 20) * 1.4}
      className="drawing"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <rect x={-10} y={-10} width={geo.width + 20} height={geo.height + 20} fill={paint.paper} onPointerDown={() => { onSelect(undefined); onSelectCable(undefined); }} />
      <RackFrame
        rack={rack}
        geo={geo}
        title={`${design.name} — ${face}`}
        subtitle={`${rack.name} · ${metrics.usedUnits}/${metrics.totalUnits} ${rack.unitSystem} · ${formatPower(metrics.typicalW)} typ · ${formatWeight(metrics.totalWeightKg)}`}
      >
        {visible.map((p) => {
          const device = lib.devices.get(p.deviceId);
          return device ? (
            <PlacedDevice key={p.id} placement={p} device={device} rack={rack} geo={geo}
              ghost={p.mount.kind === 'rack' && p.mount.face !== face}
              dragging={drag?.id === p.id && drag.moved}
              selected={p.id === selectedId} onPointerDown={startDrag(p.id)} />
          ) : null;
        })}
        <CableRoutesDrawing lib={lib} routes={routeCables(lib, design, rack, geo)} selectedId={selectedCableId} onSelect={onSelectCable} />
        {preview?.kind === 'rack' && (
          <rect data-export="skip" x={geo.originX + geo.railW} y={unitTopY(geo, rack, preview.position)}
            width={geo.bodyW} height={geo.unitPx} fill="none" stroke={paint.selection} strokeWidth={2} pointerEvents="none" />
        )}
      </RackFrame>
    </svg>
  );
}
