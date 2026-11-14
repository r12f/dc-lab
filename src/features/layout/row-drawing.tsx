import type { PointerEvent } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout, Row } from '../../domain/layout/types';
import { tileWidthOf, type DesignLookup } from '../../domain/layout/tiles';
import { tileRect } from '../../domain/layout/geometry';
import { computeRackMetrics } from '../../domain/design/metrics';
import { formatPower } from '../../domain/units';
import type { LayoutSelection } from './selection';
import { paint } from '../../theme/paint';

interface Props {
  lib: Library;
  designs: DesignLookup;
  layout: DcLayout;
  row: Row;
  /** Live power of the row (typical W). */
  powerW: number;
  selection?: LayoutSelection;
  onSelect(sel: LayoutSelection): void;
  onHeaderPointerDown(e: PointerEvent<SVGElement>): void;
  onRackHover(assignmentId: string | undefined, e?: { clientX: number; clientY: number }): void;
}

const HEADER_H = 820;

/**
 * One vertical row: header (name + power / budget, drag handle), tiles from north to south,
 * a front-side marker and assigned racks.
 */
export function RowDrawing({ lib, designs, layout, row, powerW, selection, onSelect, onHeaderPointerDown, onRackHover }: Props) {
  const tiles = Array.from({ length: row.tileCount }, (_, i) => i);
  const assignments = layout.assignments.filter((a) => a.rowId === row.id);
  const length = row.tileCount * row.tileWidthMm;
  const frontX = row.frontFacing === 'east' ? row.x + row.tileDepthMm : row.x;
  const rowSelected = selection?.kind === 'row' && selection.id === row.id;
  const budgetW = row.powerBudgetKw * 1000;
  const over = powerW > budgetW;
  const cx = row.x + row.tileDepthMm / 2;
  const selectRow = (e: { stopPropagation(): void }) => { e.stopPropagation(); onSelect({ kind: 'row', id: row.id }); };

  return (
    <g>
      <g style={{ cursor: 'move' }} onPointerDown={onHeaderPointerDown} onClick={selectRow}>
        <title>{`${row.name} — drag to move`}</title>
        <rect x={row.x} y={row.y - HEADER_H} width={row.tileDepthMm} height={HEADER_H - 40} rx={60}
          fill={rowSelected ? paint.selection : paint.frame} fillOpacity={rowSelected ? 0.35 : 1} />
        <text x={cx} y={row.y - HEADER_H + 250} fontSize={Math.min(230, row.tileDepthMm / 4.5)} textAnchor="middle" fontWeight={700}
          fill={rowSelected ? paint.ink : paint.frameText}>{row.name}</text>
        {/* Power and budget on separate lines so both stay legible at full-room zoom. */}
        <text x={cx} y={row.y - HEADER_H + 490} fontSize={Math.min(210, row.tileDepthMm / 5.5)} textAnchor="middle" fontWeight={700}
          fill={over ? '#EF4444' : rowSelected ? paint.ink : paint.frameText}>{formatPower(powerW)}</text>
        <text x={cx} y={row.y - HEADER_H + 700} fontSize={Math.min(170, row.tileDepthMm / 7)} textAnchor="middle"
          fill={over ? '#EF4444' : rowSelected ? paint.ink : paint.frameText}>{`of ${formatPower(budgetW)}`}</text>
      </g>
      {tiles.map((t) => {
        const r = tileRect(row, t);
        const sel = selection?.kind === 'tile' && selection.rowId === row.id && selection.tile === t;
        return (
          <rect key={t} x={r.x} y={r.y} width={r.widthMm} height={r.depthMm}
            fill={sel ? paint.selection : paint.slot} fillOpacity={sel ? 0.5 : 1}
            stroke={rowSelected ? paint.selection : paint.inkMuted} strokeOpacity={rowSelected ? 1 : 0.5} strokeWidth={12}
            style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onSelect({ kind: 'tile', rowId: row.id, tile: t }); }} />
        );
      })}
      <line x1={frontX} x2={frontX} y1={row.y} y2={row.y + length} stroke={paint.accent} strokeWidth={50} />
      {assignments.map((a) => {
        const design = designs(a.designId);
        const r = tileRect(row, a.startTile, tileWidthOf(lib, design));
        const power = design ? computeRackMetrics(lib, design).typicalW : 0;
        const sel = selection?.kind === 'assignment' && selection.id === a.id;
        // Two lines (label + power) must fit the rack's north–south extent and its width.
        const font = Math.min(170, (r.depthMm - 60) / 2.6, (r.widthMm - 60) / 6);
        const mx = r.x + r.widthMm / 2;
        const my = r.y + r.depthMm / 2;
        return (
          <g key={a.id} style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onSelect({ kind: 'assignment', id: a.id }); }}
            onPointerEnter={(e) => onRackHover(a.id, e)} onPointerMove={(e) => onRackHover(a.id, e)}
            onPointerLeave={() => onRackHover(undefined)}>
            <rect x={r.x + 30} y={r.y + 30} width={r.widthMm - 60} height={r.depthMm - 60} rx={40}
              fill={paint.accent} stroke={sel ? paint.selection : paint.ink} strokeWidth={sel ? 60 : 20} />
            <text x={mx} y={my - font * 0.2} fontSize={font} textAnchor="middle" fill={paint.onAccent} fontWeight={700} pointerEvents="none">{a.label}</text>
            <text x={mx} y={my + font * 0.9} fontSize={font * 0.8} textAnchor="middle" fill={paint.onAccent} opacity={0.85} pointerEvents="none">{formatPower(power)}</text>
          </g>
        );
      })}
    </g>
  );
}
