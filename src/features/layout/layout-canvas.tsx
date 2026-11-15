import { DoorArrowDefs, DoorDrawing } from './door-drawing';
import { FeedLines } from './feed-lines';
import { useState, type Ref } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { computeDcMetrics } from '../../domain/layout/metrics';
import { computeFacilityLoads, facilityCapacityKw } from '../../domain/layout/facility-load';
import { computeFloorPlan, trayRect } from '../../domain/layout/floor-plan';
import { clickSelect, isSelected, type DragKind, type ElementKind, type LayoutSelection } from './selection';
import type { LayoutEditor } from './use-layout-editor';
import { RowDrawing } from './row-drawing';
import { AreaDrawing } from './area-drawing';
import { RackTooltip } from './rack-tooltip';
import { rackSummary } from './rack-summary';
import { useDragMove } from './use-drag-move';
import { AISLE_COLORS, FACILITY_COLORS, TRAY_COLORS } from './layout-colors';
import { paint } from '../../theme/paint';
import { labelTransform, planTransform, viewSize } from '../../domain/layout/view-rotation';
import { ViewRotationContext } from './view-context';

interface Props {
  ref?: Ref<SVGSVGElement>;
  lib: Library;
  designs: DesignLookup;
  layout: DcLayout;
  editor: LayoutEditor;
  selection?: LayoutSelection;
  onSelect(sel: LayoutSelection | undefined): void;
}

const PAD = 1200;
/** Drawing scale at 100 % zoom. */
export const PX_PER_MM = 0.1;

/**
 * Room plan in millimetres (1 SVG unit = 1 mm), north up. Draw order (SVG has no z-index):
 * room, rack area, facilities, aisles, rows, then overhead trays on top.
 */
export function LayoutCanvas({ ref, lib, designs, layout: stored, editor, selection, onSelect }: Props) {
  const drag = useDragMove(lib, designs, stored, editor);
  const layout = drag.preview();
  const plan = computeFloorPlan(layout);
  const [hover, setHover] = useState<{ id: string; x: number; y: number }>();
  const { widthMm, depthMm } = layout.room;
  const ws = layout.whitespace;
  const rotation = layout.viewRotation ?? 0;
  const view = viewSize(rotation, widthMm, depthMm);
  // Fixed drawing scale (100 % = 0.1 px/mm); the canvas zoom fits it to the pane (fitKey in the module).
  const pxPerMm = PX_PER_MM;
  const rowPower = new Map(computeDcMetrics(lib, designs, layout).rows.map((r) => [r.rowId, r.typicalW]));
  const isSel = (kind: ElementKind, id: string) => isSelected(selection, kind, id);
  // Selection happens on pointer-down: the SVG captures the pointer for dragging, so element clicks never fire.
  const startDrag = (kind: DragKind, id: string) => (e: Parameters<ReturnType<typeof drag.start>>[0]) => {
    e.stopPropagation();
    const additive = e.ctrlKey || e.metaKey || e.shiftKey;
    // Pressing an already-selected element keeps the multi-selection (so it can be dragged).
    if (additive || !isSelected(selection, kind, id)) onSelect(clickSelect(selection, kind, id, additive));
    setHover(undefined);
    drag.start(kind, id)(e);
  };
  /** Press on a rack: select it (Ctrl/Shift adds or removes; pressing a selected one keeps the selection) and drag. */
  const rackDown = (id: string, e: Parameters<ReturnType<typeof drag.start>>[0]) => {
    e.stopPropagation();
    const additive = e.ctrlKey || e.metaKey || e.shiftKey;
    let next = selection;
    if (additive || !isSelected(selection, 'assignment', id)) next = clickSelect(selection, 'assignment', id, additive);
    onSelect(next);
    setHover(undefined);
    if (next?.kind === 'assignment' && next.ids.includes(id)) drag.start('assignment', id, next.ids)(e);
  };
  const ghost = (id: string) => (drag.dragging?.id === id ? 0.6 : 1);
  const rackProblem = drag.rackProblem();
  const hovered = hover && !drag.dragging && layout.assignments.find((a) => a.id === hover.id);

  return (
    <>
      <svg ref={ref} viewBox={`${-PAD} ${-PAD} ${view.w + PAD * 2} ${view.h + PAD * 2}`}
        width={(view.w + PAD * 2) * pxPerMm} className="drawing"
        onPointerMove={drag.move} onPointerUp={drag.end}>
        <rect x={-PAD} y={-PAD} width={view.w + PAD * 2} height={view.h + PAD * 2} fill={paint.paper} onClick={() => onSelect(undefined)} />
        <text x={0} y={-PAD / 2} fontSize={300} fontWeight={700} fill={paint.ink}>{layout.name}</text>
        {/* North arrow points to where north is in the rotated view. */}
        <g transform={`translate(${view.w - 250} ${-PAD / 2 - 80}) rotate(${-rotation})`}>
          <path d="M0,-200 L90,60 L0,10 L-90,60 Z" fill={paint.ink} />
          <text y={230} fontSize={200} textAnchor="middle" fill={paint.inkMuted} transform={rotation ? `rotate(${rotation} 0 160)` : undefined}>N</text>
        </g>
        <ViewRotationContext.Provider value={rotation}>
        <g data-plan="" transform={planTransform(rotation, widthMm, depthMm) || undefined}>
        <rect x={0} y={0} width={widthMm} height={depthMm} fill={paint.slot} stroke={paint.ink} strokeWidth={40}
          onClick={() => onSelect(undefined)} />
        <rect x={ws.x} y={ws.y} width={ws.widthMm} height={ws.depthMm} fill="none" stroke={paint.inkMuted}
          strokeWidth={30} strokeDasharray="200 120" pointerEvents="none" />
        <text x={ws.x + 80} y={ws.y + ws.depthMm + 260} fontSize={200} fill={paint.inkMuted} pointerEvents="none"
          transform={labelTransform(rotation, ws.x + 80, ws.y + ws.depthMm + 260, 'along', 0)}>
          {`Rack area ${ws.widthMm / 1000} × ${ws.depthMm / 1000} m · used ${plan.usedWidthMm / 1000} m`}
        </text>
        <DoorArrowDefs />
        {layout.doors.map((d) => (
          <g key={d.id} opacity={ghost(d.id)}>
            <DoorDrawing layout={layout} door={d} selected={isSel('door', d.id)} onPointerDown={startDrag('door', d.id)} />
          </g>
        ))}
        {layout.facilities.map((f) => (
          <g key={f.id} opacity={ghost(f.id)}>
            <AreaDrawing rect={f} fill={FACILITY_COLORS[f.kind]} opacity={0.45}
              label={`${f.name}${facilityCapacityKw(lib, f) ? ` ${facilityCapacityKw(lib, f)} kW` : ''}`}
              selected={isSel('facility', f.id)}
              onPointerDown={startDrag('facility', f.id)} />
          </g>
        ))}
        {plan.bands.filter((b) => b.kind === 'aisle').map((b) => {
          const a = layout.aisles.find((x) => x.id === b.id)!;
          return (
            <g key={a.id} opacity={ghost(a.id)}>
              <AreaDrawing rect={b.rect} fill={AISLE_COLORS[a.kind]} label={`${a.kind}${b.cross ? ' cross' : ''} aisle`} cursor={b.cross ? 'pointer' : 'move'}
                selected={isSel('aisle', a.id)}
                onPointerDown={startDrag('aisle', a.id)} />
            </g>
          );
        })}
        {plan.bands.filter((b) => b.kind === 'row').map((b) => {
          const r = layout.rows.find((x) => x.id === b.id)!;
          return (
            <g key={r.id} opacity={ghost(r.id)}>
              <RowDrawing lib={lib} designs={designs} layout={layout} row={r} rect={b.rect} powerW={rowPower.get(r.id) ?? 0}
                selection={selection} onSelect={onSelect} onHeaderPointerDown={startDrag('row', r.id)} onRackPointerDown={rackDown}
                onRackHover={(id, e) => setHover(id && e ? { id, x: e.clientX, y: e.clientY } : undefined)} />
            </g>
          );
        })}
        <FeedLines layout={layout} plan={plan} loads={computeFacilityLoads(lib, designs, layout)}
          highlight={(fid, tid) => isSel('facility', fid) || isSel('row', tid) || isSel('aisle', tid)} />
        {layout.trays.map((t) => {
          const rect = trayRect(plan, t);
          return rect && (
            <g key={t.id} opacity={ghost(t.id)}>
              <AreaDrawing rect={rect} fill={TRAY_COLORS[t.kind]} opacity={0.35} label={`${t.kind} tray (overhead)`} dashed labelAt={0.8} overhead
                cursor="move" selected={isSel('tray', t.id)}
                onPointerDown={startDrag('tray', t.id)} />
            </g>
          );
        })}
        </g>
        </ViewRotationContext.Provider>
        {rackProblem && (
          <text x={0} y={-PAD / 2 + 300} fontSize={220} fontWeight={700} fill={paint.danger} pointerEvents="none">{`Cannot move here — ${rackProblem}`}</text>
        )}
      </svg>
      {hovered && <RackTooltip lines={rackSummary(lib, designs, hovered)} x={hover.x} y={hover.y} />}
    </>
  );
}
