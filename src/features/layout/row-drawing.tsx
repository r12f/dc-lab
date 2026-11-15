import type { PointerEvent } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout, Rect, Row } from '../../domain/layout/types';
import { formatTiles, tilesUsed, tileWidthOf, type DesignLookup } from '../../domain/layout/tiles';
import { tileRect } from '../../domain/layout/floor-plan';
import { computeRackMetrics } from '../../domain/design/metrics';
import { formatPower } from '../../domain/units';
import { clickTile, isSelected, isTileSelected, type LayoutSelection } from './selection';
import { paint } from '../../theme/paint';
import { useLabels } from './view-context';
import { assignmentRole, servedRacks } from '../../domain/layout/infra';

/** Fill of infrastructure racks: power amber, CDU cyan (as their facility colors); IT racks use the accent. */
const INFRA_FILL = { power: '#475569', cdu: '#06B6D4', chiller: '#0E7490' } as const;

interface Props {
  lib: Library;
  designs: DesignLookup;
  layout: DcLayout;
  row: Row;
  /** Where the floor plan put the row. */
  rect: Rect;
  /** Live power of the row (typical W). */
  powerW: number;
  selection?: LayoutSelection;
  onSelect(sel: LayoutSelection | undefined): void;
  onHeaderPointerDown(e: PointerEvent<SVGElement>): void;
  /** Press on a rack: select it (Ctrl/Shift adds) and start dragging the selected racks. */
  onRackPointerDown(assignmentId: string, e: PointerEvent<SVGElement>): void;
  onRackHover(assignmentId: string | undefined, e?: { clientX: number; clientY: number }): void;
}

const HEADER_H = 1040;

/** kW without trailing zeros: 0, 12.5, 400. */
const kw = (w: number) => String(Math.round(w / 100) / 10);

/**
 * One vertical row: header (name + power / budget, drag handle), tiles from north to south,
 * a front-side marker and assigned racks.
 */
export function RowDrawing({ lib, designs, layout, row, rect, powerW, selection, onSelect, onHeaderPointerDown, onRackPointerDown, onRackHover }: Props) {
  const tiles = Array.from({ length: row.tileCount }, (_, i) => i);
  const assignments = layout.assignments.filter((a) => a.rowId === row.id);
  const length = row.tileCount * row.tileWidthMm;
  const frontX = row.frontFacing === 'east' ? rect.x + rect.widthMm : rect.x;
  const rowSelected = isSelected(selection, 'row', row.id);
  const used = formatTiles(tilesUsed(lib, designs, assignments));
  const budgetW = row.powerBudgetKw * 1000;
  const over = powerW > budgetW;
  const cx = rect.x + rect.widthMm / 2;
  // Header text must fit the box's on-screen width, which is its height when the view is turned 90°/270°.
  const headW = Math.min(row.tileDepthMm, HEADER_H - 40) - 80;
  const headCy = rect.y - HEADER_H + (HEADER_H - 40) / 2;
  const { upright, screen } = useLabels();
  const powerLine = `${kw(powerW)}/${kw(budgetW)}kW`;
  const tilesLine = `${used}/${row.tileCount} tiles`;
  /** Largest font (≤ cap) at which `text` fits the header width. */
  const fit = (text: string, cap: number) => Math.min(cap, headW / Math.max(1, text.length * 0.58));

  return (
    <g>
      <g style={{ cursor: 'move' }} onPointerDown={onHeaderPointerDown} onClick={(e) => e.stopPropagation()}>
        <title>{`${row.name} · ${used}/${row.tileCount} rack tiles — drag sideways to reorder, Ctrl-click to multi-select`}</title>
        <rect x={rect.x} y={rect.y - HEADER_H} width={row.tileDepthMm} height={HEADER_H - 40} rx={60}
          fill={rowSelected ? paint.selection : paint.frame} fillOpacity={rowSelected ? 0.35 : 1} />
        {/* Header lines stay upright on screen when the view is rotated (box is about square). */}
        <g transform={upright(cx, headCy)}>
          <text x={cx} y={headCy - 200} fontSize={fit(row.name, 260)} textAnchor="middle" fontWeight={700}
            fill={rowSelected ? paint.ink : paint.frameText}>{row.name}</text>
          {/* Power / budget and tiles: one compact line each, sized to fit the header. */}
          <text x={cx} y={headCy + 90} fontSize={fit(powerLine, 210)} textAnchor="middle"
            fill={over ? paint.danger : rowSelected ? paint.ink : paint.frameText}>{powerLine}</text>
          <text x={cx} y={headCy + 340} fontSize={fit(tilesLine, 210)} textAnchor="middle"
            fill={rowSelected ? paint.ink : paint.frameText}>{tilesLine}</text>
        </g>
      </g>
      {tiles.map((t) => {
        const r = tileRect(rect, row, t);
        const sel = isTileSelected(selection, row.id, t);
        return (
          <rect key={t} x={r.x} y={r.y} width={r.widthMm} height={r.depthMm}
            fill={sel ? paint.selection : paint.slot} fillOpacity={sel ? 0.5 : 1}
            stroke={rowSelected ? paint.selection : paint.inkMuted} strokeOpacity={rowSelected ? 1 : 0.5} strokeWidth={12}
            style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onSelect(clickTile(selection, row.id, t, { toggle: e.ctrlKey || e.metaKey, range: e.shiftKey })); }} />
        );
      })}
      <line x1={frontX} x2={frontX} y1={rect.y} y2={rect.y + length} stroke={paint.accent} strokeWidth={50} />
      {assignments.map((a) => {
        const design = designs(a.designId);
        const r = tileRect(rect, row, a.startTile, tileWidthOf(lib, design));
        const power = design ? computeRackMetrics(lib, design).typicalW : 0;
        const sel = isSelected(selection, 'assignment', a.id);
        const role = assignmentRole(lib, designs, a);
        const fill = role === 'it' ? paint.accent : INFRA_FILL[role];
        // Racks served by the selected power / CDU rack get a dashed ring in that rack's color.
        const selInfra = selection?.kind === 'assignment' && selection.ids.length === 1 ? layout.assignments.find((x) => x.id === selection.ids[0]) : undefined;
        const servedBySel = !!selInfra && selInfra.id !== a.id && assignmentRole(lib, designs, selInfra) !== 'it'
          && servedRacks(lib, designs, layout, selInfra).some((x) => x.id === a.id);
        const selRole = selInfra ? assignmentRole(lib, designs, selInfra) : 'it';
        // Three lines — design abbreviation (large), rack label, power — fit the rack as seen on screen.
        const sb = screen(r.widthMm, r.depthMm);
        const font = Math.min(150, (sb.h - 60) / 4.2, (sb.w - 60) / 6);
        const abbr = design?.abbr ?? '?';
        const mx = r.x + r.widthMm / 2;
        const my = r.y + r.depthMm / 2;
        return (
          <g key={a.id} style={{ cursor: 'move' }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => onRackPointerDown(a.id, e)}
            onPointerEnter={(e) => onRackHover(a.id, e)} onPointerMove={(e) => onRackHover(a.id, e)}
            onPointerLeave={() => onRackHover(undefined)}>
            <rect x={r.x + 30} y={r.y + 30} width={r.widthMm - 60} height={r.depthMm - 60} rx={40}
              fill={fill} stroke={sel ? paint.selection : paint.ink} strokeWidth={sel ? 60 : 20} />
            {servedBySel && selRole !== 'it' && (
              <rect x={r.x + 90} y={r.y + 90} width={r.widthMm - 180} height={r.depthMm - 180} rx={30} fill="none"
                stroke={INFRA_FILL[selRole]} strokeWidth={50} strokeDasharray="120 80" pointerEvents="none" />
            )}
            <g transform={upright(mx, my)} pointerEvents="none">
            <text x={mx} y={my - font * 0.55} fontSize={Math.min(font * 1.5, (sb.w - 80) / (abbr.length * 0.72))} textAnchor="middle"
              fill={paint.onAccent} fontWeight={800} pointerEvents="none">{abbr}</text>
            <text x={mx} y={my + font * 0.75} fontSize={font * 0.8} textAnchor="middle" fill={paint.onAccent} fontWeight={600} pointerEvents="none">{a.label}</text>
            <text x={mx} y={my + font * 1.7} fontSize={font * 0.75} textAnchor="middle" fill={paint.onAccent} opacity={0.85} pointerEvents="none">{role === 'it' ? formatPower(power) : role === 'power' ? 'POWER' : role === 'cdu' ? 'CDU' : 'CHILLER'}</text>
            </g>
          </g>
        );
      })}
    </g>
  );
}
