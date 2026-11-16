import { unitsIn } from '../../domain/units';
import { useMemo, useState, type DragEvent, type PointerEvent, type Ref } from 'react';
import type { Library } from '../../domain/library/library';
import type { Mount, Placement, RackDesign } from '../../domain/design/types';
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
import { cableGutter, routeCables } from './cable-routes';
import { CableRoutesDrawing } from './cable-routes-drawing';
import { REAR_ONLY_KINDS } from '../../domain/rack/side-elements';
import { visibleCables, type ViewFilter } from '../../domain/design/device-filter';
import { placedDevice } from '../../domain/design/sizing';
import { cableGroupsOnFace } from '../../domain/device/ports';
import { deviceFaceSeenFrom } from '../../domain/design/cable-assign';

interface Props {
  ref?: Ref<SVGSVGElement>;
  lib: Library;
  design: RackDesign;
  selectedId?: string;
  onSelect(id: string | undefined): void;
  selectedCableId?: string;
  onSelectCable(id: string | undefined): void;
  onDropDevice(deviceId: string, mount: Mount): void;
  onMove(placementId: string, mount: Mount): void;
  /** Draw cable runs (default true). */
  showCables?: boolean;
  /** Device filter: links touching these placements are not drawn, the devices are dimmed. */
  /** Device / cable-type filter: hidden devices drawn faded, their links and hidden cable types not drawn. */
  filter?: ViewFilter;
  /** Faces shown (default both). */
  faces?: readonly PortFace[];
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
const CABLE_GUTTER = 34;

/**
 * Rack elevation canvas. Palette devices are dropped via HTML drag-and-drop;
 * placed devices are moved with pointer events (SVG has no native drag).
 */
/** Front and rear elevations side by side in one drawing; drops and drags go to the face under the pointer. */
/**
 * A rack-mounted device is drawn on its mount face, and on the other face when it reaches through (full depth) or
 * has ports on that side (PSU inlets, rear ports): cables to those ports end there.
 */
export function rackDeviceOnFace(lib: Library, design: RackDesign, p: Placement, face: PortFace): boolean {
  if (p.mount.kind !== 'rack') return false;
  if (p.mount.face === face) return true;
  const rack = lib.racks.get(design.templateId);
  const d = placedDevice(lib, design, p);
  return !!d && !!rack && (isFullDepth(d, rack) || cableGroupsOnFace(d, deviceFaceSeenFrom(p, face)).length > 0);
}

export function RackElevation({ ref, lib, design, selectedId, onSelect, selectedCableId, onSelectCable, onDropDevice, onMove, showCables = true, filter, faces = FACES }: Props) {
  const [drag, setDrag] = useState<DragState>();
  const rack = lib.racks.get(design.templateId);
  // Links follow the device / cable filters (same object when nothing is hidden, so the drawing stays memoized).
  const cableDesign = useMemo(() => (filter ? visibleCables(lib, design, filter) : design), [lib, design, filter]);
  if (!rack) return <p className="muted">Unknown rack template {design.templateId}</p>;
  // Cable channels outside the rails on both sides, so runs never cover the unit numbers.
  // The channels widen with the run count so every run keeps its own lane.
  // PDU bays are on the rear: the front panel leaves them out (and the PDUs in them).
  // No cable drawn (all filtered out / hidden): no channels either.
  const gutter = showCables && cableDesign.cables.length > 0 ? cableGutter(lib, cableDesign, CABLE_GUTTER) : 0;
  const geoRear = rackGeometry(rack, gutter);
  const rackFront = { ...rack, sideElements: rack.sideElements.filter((e) => !REAR_ONLY_KINDS.has(e.kind)) };
  const geoFront = rackGeometry(rackFront, gutter);
  const geoOf = (face: PortFace) => (face === 'rear' ? geoRear : geoFront);
  const rackOf = (face: PortFace) => (face === 'rear' ? rack : rackFront);
  const geo = geoRear;
  const metrics = computeRackMetrics(lib, design);
  const issues = designIssues(lib, design);
  const visibleOn = (face: PortFace) => design.placements.filter((p) => {
    if (p.mount.kind === 'side') return rackOf(face).sideElements.some((e) => e.id === (p.mount as { elementId: string }).elementId);
    return rackDeviceOnFace(lib, design, p, face);
  });
  // Each face occupies one panel; the rear panel is shifted right by `panelW`.
  // Only the faces shown get a panel; a single face starts at the left edge.
  const both = faces.includes('front') && faces.includes('rear');
  const panelW = geoFront.width + 20;
  const offsetOf = (face: PortFace) => (face === 'rear' && both ? panelW : 0);
  const faceAt = (x: number): PortFace => (both ? (x >= panelW - 10 ? 'rear' : 'front') : faces[0]);

  /** Pointer in the coordinates of the face panel it is over. */
  const svgPoint = (e: { currentTarget: Element; clientX: number; clientY: number }) => {
    const pt = toSvgPoint((e.currentTarget as Element).closest('svg') as SVGSVGElement, e.clientX, e.clientY);
    const face = faceAt(pt.x);
    return { x: pt.x - offsetOf(face), y: pt.y, face };
  };

  const onDrop = (e: DragEvent<SVGSVGElement>) => {
    e.preventDefault();
    const [deviceId] = e.dataTransfer.getData(DEVICE_DRAG_TYPE).split('|');
    if (!deviceId) return;
    const pt = svgPoint(e);
    const mount = mountAt(geoOf(pt.face), rack, pt.face, pt.x, pt.y);
    const device = lib.devices.get(deviceId);
    // The pointer marks the device's middle; a tall device dropped near the top/bottom slides inside the rack.
    if (mount.kind === 'rack' && device) {
      const units = Math.max(1, unitsIn(device.height, rack.unitSystem));
      const bottom = mount.position - Math.floor((units - 1) / 2);
      mount.position = Math.max(1, Math.min(rack.units - units + 1, bottom));
    }
    onDropDevice(deviceId, mount);
  };

  const startDrag = (id: string, face: PortFace) => (e: PointerEvent<SVGGElement>) => {
    e.stopPropagation();
    onSelect(id);
    const p = design.placements.find((x) => x.id === id);
    const d = p && placedDevice(lib, design, p);
    if (!p || !d) return;
    const pt = svgPoint(e);
    const r = placementRect(p, d, rack, geoOf(face));
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
    const r = placementRect(p, d, rack, geoOf(drag.face));
    const mount = mountAt(geoOf(drag.face), rack, drag.face, drag.x, drag.y + r.h - geo.unitPx / 2);
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
  const totalW = (faces.includes('front') ? panelW : 0) + (faces.includes('rear') ? geoRear.width + 20 : 0);
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
      {faces.map((face) => (
        <g key={face} transform={offsetOf(face) ? `translate(${offsetOf(face)} 0)` : undefined}>
          <RackFrame
            rack={rackOf(face)}
            geo={geoOf(face)}
            title={`${design.name} — ${face}`}
            subtitle={`${rack.name} · ${metrics.usedUnits}/${metrics.totalUnits} ${rack.unitSystem} · ${formatPower(metrics.typicalW)} typ · ${formatWeight(metrics.totalWeightKg)}`}
          >
            {visibleOn(face).map((p) => {
              const device = placedDevice(lib, design, p);
              return device ? (
                <PlacedDevice key={p.id} placement={p} device={device} rack={rack} geo={geoOf(face)}
                  ghost={p.mount.kind === 'rack' && p.mount.face !== face}
                  dragging={drag?.id === p.id && drag.moved}
                  selected={p.id === selectedId} issues={issues.placements.get(p.id)} onPointerDown={startDrag(p.id, face)}
                  filteredOut={!!filter?.hiddenDevices.has(p.id)} />
              ) : null;
            })}
            {showCables && (
              <CableRoutesDrawing lib={lib} design={design} routes={routeCables(lib, cableDesign, rack, geoOf(face), face)} selectedId={selectedCableId}
                errorIds={new Set(issues.cables.keys())} onSelect={onSelectCable} />
            )}
            {/* Rack-wide problems: red frame around the rack body and the messages under the title. */}
            {issues.rack.length > 0 && (
              <g pointerEvents="none">
                <rect x={geoOf(face).originX - 3} y={geo.originY - 7} width={geo.railW * 2 + geo.bodyW + 6} height={geo.bodyH + 14} rx={4}
                  fill="none" stroke={paint.danger} strokeWidth={3} />
                {face === faces[0] && issues.rack.map((w, i) => (
                  <text key={w} x={geoOf(face).originX} y={geo.height + 4 + i * 12} fontSize={10} fontWeight={700} fill={paint.danger}>{`⚠ ${w}`}</text>
                ))}
              </g>
            )}
            {preview?.kind === 'rack' && preview.face === face && (
              <rect data-export="skip" x={geoOf(face).originX + geo.railW} y={unitTopY(geo, rack, preview.position)}
                width={geo.bodyW} height={geo.unitPx} fill="none" stroke={previewBad ? paint.danger : paint.selection} strokeWidth={2} pointerEvents="none" />
            )}
          </RackFrame>
        </g>
      ))}
    </svg>
  );
}
