import { useState, type Ref } from 'react';
import type { Library } from '../../domain/library/Library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { computeDcMetrics } from '../../domain/layout/metrics';
import type { MovableKind } from '../../domain/layout/geometry';
import type { LayoutSelection } from './selection';
import { RowDrawing } from './RowDrawing';
import { AreaDrawing } from './AreaDrawing';
import { RackTooltip } from './RackTooltip';
import { rackSummary } from './rackSummary';
import { useDragMove } from './useDragMove';
import { paint } from '../../theme/paint';

interface Props {
  ref?: Ref<SVGSVGElement>;
  lib: Library;
  designs: DesignLookup;
  layout: DcLayout;
  selection?: LayoutSelection;
  onSelect(sel: LayoutSelection | undefined): void;
  onMove(kind: MovableKind, id: string, x: number, y: number): void;
}

/** Aisle colors are semantic (cold = blue, hot = red) and stay fixed across themes. */
const AISLE = { cold: '#3B82F6', hot: '#EF4444' };
const PAD = 1200;

/** Room plan drawn in millimetres (1 SVG unit = 1 mm), north up. */
export function LayoutCanvas({ ref, lib, designs, layout, selection, onSelect, onMove }: Props) {
  const drag = useDragMove(layout, onMove);
  const [hover, setHover] = useState<{ id: string; x: number; y: number }>();
  const { widthMm, depthMm } = layout.room;
  // Fit the room width to the pane; taller rooms scroll vertically.
  const pxPerMm = Math.min(1100 / widthMm, 0.1);
  const rowPower = new Map(computeDcMetrics(lib, designs, layout).rows.map((r) => [r.rowId, r.typicalW]));
  const shift = (kind: MovableKind, id: string) => {
    const o = drag.offset(kind, id);
    return o.dx || o.dy ? `translate(${o.dx} ${o.dy})` : undefined;
  };
  const startDrag = (kind: MovableKind, id: string) => (e: Parameters<ReturnType<typeof drag.start>>[0]) => {
    e.stopPropagation();
    onSelect({ kind, id });
    setHover(undefined);
    drag.start(kind, id)(e);
  };
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
        {layout.aisles.map((a) => (
          <g key={a.id} transform={shift('aisle', a.id)}>
            <AreaDrawing rect={a} fill={a.kind === 'cold' ? AISLE.cold : AISLE.hot} label={`${a.kind} aisle`}
              selected={selection?.kind === 'aisle' && selection.id === a.id}
              onClick={() => onSelect({ kind: 'aisle', id: a.id })} onPointerDown={startDrag('aisle', a.id)} />
          </g>
        ))}
        {layout.trays.map((t) => (
          <g key={t.id} transform={shift('tray', t.id)}>
            <AreaDrawing rect={t} fill={t.kind === 'data' ? paint.warn : paint.inkMuted} label={`${t.kind} tray`} dashed
              selected={selection?.kind === 'tray' && selection.id === t.id}
              onClick={() => onSelect({ kind: 'tray', id: t.id })} onPointerDown={startDrag('tray', t.id)} />
          </g>
        ))}
        {layout.rows.map((r) => (
          <g key={r.id} transform={shift('row', r.id)}>
            <RowDrawing lib={lib} designs={designs} layout={layout} row={r} powerW={rowPower.get(r.id) ?? 0}
              selection={selection} onSelect={onSelect} onHeaderPointerDown={startDrag('row', r.id)}
              onRackHover={(id, e) => setHover(id && e ? { id, x: e.clientX, y: e.clientY } : undefined)} />
          </g>
        ))}
      </svg>
      {hovered && <RackTooltip lines={rackSummary(lib, designs, hovered)} x={hover.x} y={hover.y} />}
    </>
  );
}
