import { useState, type Ref } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { computeDcMetrics } from '../../domain/layout/metrics';
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

/**
 * Room plan in millimetres (1 SVG unit = 1 mm), north up. Draw order (SVG has no z-index):
 * room, rack area, facilities, aisles, rows, then overhead trays on top.
 */
export function LayoutCanvas({ ref, lib, designs, layout: stored, editor, selection, onSelect }: Props) {
  const drag = useDragMove(stored, editor);
  const layout = drag.preview();
  const plan = computeFloorPlan(layout);
  const [hover, setHover] = useState<{ id: string; x: number; y: number }>();
  const { widthMm, depthMm } = layout.room;
  const ws = layout.whitespace;
  // Fit the room width to the pane; taller rooms scroll vertically.
  const pxPerMm = Math.min(1100 / widthMm, 0.1);
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
  const ghost = (id: string) => (drag.dragging?.id === id ? 0.6 : 1);
  const hovered = hover && !drag.dragging && layout.assignments.find((a) => a.id === hover.id);

  return (
    <>
      <svg ref={ref} viewBox={`${-PAD} ${-PAD} ${widthMm + PAD * 2} ${depthMm + PAD * 2}`}
        width={(widthMm + PAD * 2) * pxPerMm} className="drawing"
        onPointerMove={drag.move} onPointerUp={drag.end}>
        <rect x={-PAD} y={-PAD} width={widthMm + PAD * 2} height={depthMm + PAD * 2} fill={paint.paper} onClick={() => onSelect(undefined)} />
        <text x={0} y={-PAD / 2} fontSize={300} fontWeight={700} fill={paint.ink}>{layout.name}</text>
        <text x={widthMm} y={-PAD / 2} fontSize={200} textAnchor="end" fill={paint.inkMuted}>N ↑</text>
        <rect x={0} y={0} width={widthMm} height={depthMm} fill={paint.slot} stroke={paint.ink} strokeWidth={40}
          onClick={() => onSelect(undefined)} />
        <rect x={ws.x} y={ws.y} width={ws.widthMm} height={ws.depthMm} fill="none" stroke={paint.inkMuted}
          strokeWidth={30} strokeDasharray="200 120" pointerEvents="none" />
        <text x={ws.x + 80} y={ws.y + ws.depthMm + 260} fontSize={200} fill={paint.inkMuted} pointerEvents="none">
          {`Rack area ${ws.widthMm / 1000} × ${ws.depthMm / 1000} m · used ${plan.usedWidthMm / 1000} m`}
        </text>
        {layout.facilities.map((f) => (
          <g key={f.id} opacity={ghost(f.id)}>
            <AreaDrawing rect={f} fill={FACILITY_COLORS[f.kind]} opacity={0.45}
              label={`${f.name}${f.capacityKw ? ` ${f.capacityKw} kW` : ''}`}
              selected={isSel('facility', f.id)}
              onPointerDown={startDrag('facility', f.id)} />
          </g>
        ))}
        {plan.bands.filter((b) => b.kind === 'aisle').map((b) => {
          const a = layout.aisles.find((x) => x.id === b.id)!;
          return (
            <g key={a.id} opacity={ghost(a.id)}>
              <AreaDrawing rect={b.rect} fill={AISLE_COLORS[a.kind]} label={`${a.kind} aisle`} cursor="ew-resize"
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
                selection={selection} onSelect={onSelect} onHeaderPointerDown={startDrag('row', r.id)}
                onRackHover={(id, e) => setHover(id && e ? { id, x: e.clientX, y: e.clientY } : undefined)} />
            </g>
          );
        })}
        {layout.trays.map((t) => {
          const rect = trayRect(plan, t);
          return rect && (
            <g key={t.id} opacity={ghost(t.id)}>
              <AreaDrawing rect={rect} fill={TRAY_COLORS[t.kind]} opacity={0.35} label={`${t.kind} tray (overhead)`} dashed labelAt={0.8}
                cursor="ew-resize" selected={isSel('tray', t.id)}
                onPointerDown={startDrag('tray', t.id)} />
            </g>
          );
        })}
      </svg>
      {hovered && <RackTooltip lines={rackSummary(lib, designs, hovered)} x={hover.x} y={hover.y} />}
    </>
  );
}
