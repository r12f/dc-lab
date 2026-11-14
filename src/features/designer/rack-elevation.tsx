import { unitsIn } from '../../domain/units';
import { useState, type DragEvent, type PointerEvent, type Ref } from 'react';
import type { Library } from '../../domain/library/library';
import type { Mount, RackDesign } from '../../domain/design/types';
import type { PortFace } from '../../domain/device/types';
import { computeRackMetrics } from '../../domain/design/metrics';
import { isFullDepth } from '../../domain/design/placement';
import { formatPower, formatWeight } from '../../domain/units';
import { RackFrame } from '../../drawing/rack-frame';
import { rackGeometry, unitTopY } from '../../drawing/rack-geometry';
import { toSvgPoint } from '../../io/svg-point';
import { DEVICE_DRAG_TYPE } from './device-palette';
import { designIssues } from '../../domain/design/issues';
import { placementProblem } from '../../domain/design/placement';
import { PlacedDevice, placementRect } from './placed-device';
import { mountAt } from './mount-at';
import { paint } from '../../theme/paint';
import { routeCables } from './cable-routes';
import { CableRoutesDrawing } from './cable-routes-drawing';
import { placedDevice } from '../../domain/design/sizing';

interface Props {
  ref?: Ref<SVGSVGElement>;
  lib: Library;
  design: RackDesign;
  selectedId?: string;
  onSelect(id: string | undefined): void;
  selectedCableId?: string;
  onSelectCable(id: string | undefined): void;
  onDropDevice(deviceId: string, mount: Mount, variantId?: string): void;
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
  /** Face (half of the drawing) the device is being dragged in. */
  face: PortFace;
}

const FACES: PortFace[] = ['front', 'rear'];

/**
 * Rack elevation canvas. Palette devices are dropped via HTML drag-and-drop;
 * placed devices are moved with pointer events (SVG has no native drag).
 */
/** Front and rear elevations side by side in one drawing; drops and drags go to the face under the pointer. */
export function RackElevation({ ref, lib, design, selectedId, onSelect, selectedCableId, onSelectCable, onDropDevice, onMove }: Props) {
  const [drag, setDrag] = useState<DragState>();
  const rack = lib.racks.get(design.templateId);
  if (!rack) return <p className="muted">Unknown rack template {design.templateId}</p>;
  const geo = rackGeometry(rack);
  const metrics = computeRackMetrics(lib, design);
  const issues = designIssues(lib, design);
  const visibleOn = (face: PortFace) => design.placements.filter((p) => {
    if (p.mount.kind === 'side' || p.mount.face === face) return true;
    const d = placedDevice(lib, design, p);
    return !!d && isFullDepth(d, rack);
  });
  // Each face occupies one panel; the rear panel is shifted right by `panelW`.
  const panelW = geo.width + 20;
  const offsetOf = (face: PortFace) => (face === 'rear' ? panelW : 0);
  const faceAt = (x: number): PortFace => (x >= panelW - 10 ? 'rear' : 'front');

  /** Pointer in the coordinates of the face panel it is over. */
  const svgPoint = (e: { currentTarget: Element; clientX: number; clientY: number }) => {
    const pt = toSvgPoint((e.currentTarget as Element).closest('svg') as SVGSVGElement, e.clientX, e.clientY);
    const face = faceAt(pt.x);
    return { x: pt.x - offsetOf(face), y: pt.y, face };
  };

  const onDrop = (e: DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    const [deviceId, variantId] = e.dataTransfer.getData(DEVICE_DRAG_TYPE).split('|');
    if (!deviceId) return;
    const pt = svgPoint(e);
    const mount = mountAt(geo, rack, pt.face, pt.x, pt.y);
    const device = lib.devices.get(deviceId);
    // The pointer marks the device's middle; a tall device dropped near the top/bottom slides inside the rack.
    if (mount.kind === 'rack' && device) {
      const units = Math.max(1, unitsIn(device.height, rack.unitSystem));
      const bottom = mount.position - Math.floor((units - 1) / 2);
      mount.position = Math.max(1, Math.min(rack.units - units + 1, bottom));
    }
    onDropDevice(deviceId, mount, variantId || undefined);
  };

  const startDrag = (id: string, face: PortFace) => (e: PointerEvent<SVGGElement>) => {
    e.stopPropagation();
    onSelect(id);
    const p = design.placements.find((x) => x.id === id);
    const d = p && placedDevice(lib, design, p);
    if (!p || !d) return;
    const pt = svgPoint(e);
    const r = placementRect(p, d, rack, geo);
    (e.currentTarget.closest('svg') as SVGSVGElement).setPointerCapture(e.pointerId);
    setDrag({ id, dy: pt.y - r.y, y: r.y, x: pt.x, moved: false, face });
  };

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const pt = svgPoint(e);
    setDrag({ ...drag, x: pt.x, y: pt.y - drag.dy, moved: true, face: pt.face });
  };

  /** Mount for the current drag: bottom unit under the device's bottom edge. */
  const dragMount = (): Mount | undefined => {
    if (!drag) return undefined;
    const p = design.placements.find((x) => x.id === drag.id);
    const d = p && placedDevice(lib, design, p);
    if (!p || !d) return undefined;
    const r = placementRect(p, d, rack, geo);
    const mount = mountAt(geo, rack, drag.face, drag.x, drag.y + r.h - geo.unitPx / 2);
    return mount;
  };

  const onPointerUp = () => {
    const mount = dragMount();
    if (drag?.moved && mount) onMove(drag.id, mount);
    setDrag(undefined);
  };

  const preview = drag?.moved ? dragMount() : undefined;
  // Drop target in red when the device would not fit there.
  const dragged = drag && design.placements.find((x) => x.id === drag.id);
  const draggedDevice = dragged && lib.devices.get(dragged.deviceId);
  const previewBad = !!(preview && draggedDevice && placementProblem(lib, design, draggedDevice, preview, drag?.id));

  const h = geo.height + 14 + issues.rack.length * 12;
  const totalW = panelW * 2;
  return (
    <svg
      ref={ref}
      viewBox={`-10 -10 ${totalW} ${h}`}
      width={totalW * 1.4}
      className="drawing"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <rect x={-10} y={-10} width={totalW} height={h} fill={paint.paper} onPointerDown={() => { onSelect(undefined); onSelectCable(undefined); }} />
      {FACES.map((face) => (
        <g key={face} transform={face === 'rear' ? `translate(${panelW} 0)` : undefined}>
          <RackFrame
            rack={rack}
            geo={geo}
            title={`${design.name} — ${face}`}
            subtitle={`${rack.name} · ${metrics.usedUnits}/${metrics.totalUnits} ${rack.unitSystem} · ${formatPower(metrics.typicalW)} typ · ${formatWeight(metrics.totalWeightKg)}`}
          >
            {visibleOn(face).map((p) => {
              const device = placedDevice(lib, design, p);
              return device ? (
                <PlacedDevice key={p.id} placement={p} device={device} rack={rack} geo={geo}
                  ghost={p.mount.kind === 'rack' && p.mount.face !== face}
                  dragging={drag?.id === p.id && drag.moved}
                  selected={p.id === selectedId} issues={issues.placements.get(p.id)} onPointerDown={startDrag(p.id, face)} />
              ) : null;
            })}
            <CableRoutesDrawing lib={lib} routes={routeCables(lib, design, rack, geo)} selectedId={selectedCableId}
              errorIds={new Set(issues.cables.keys())} onSelect={onSelectCable} />
            {/* Rack-wide problems: red frame around the rack body and the messages under the title. */}
            {issues.rack.length > 0 && (
              <g pointerEvents="none">
                <rect x={geo.originX - 3} y={geo.originY - 7} width={geo.railW * 2 + geo.bodyW + 6} height={geo.bodyH + 14} rx={4}
                  fill="none" stroke={paint.danger} strokeWidth={3} />
                {face === 'front' && issues.rack.map((w, i) => (
                  <text key={w} x={geo.originX} y={geo.height + 4 + i * 12} fontSize={10} fontWeight={700} fill={paint.danger}>{`⚠ ${w}`}</text>
                ))}
              </g>
            )}
            {preview?.kind === 'rack' && preview.face === face && (
              <rect data-export="skip" x={geo.originX + geo.railW} y={unitTopY(geo, rack, preview.position)}
                width={geo.bodyW} height={geo.unitPx} fill="none" stroke={previewBad ? paint.danger : paint.selection} strokeWidth={2} pointerEvents="none" />
            )}
          </RackFrame>
        </g>
      ))}
    </svg>
  );
}
