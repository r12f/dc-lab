import type { Library } from '../../domain/library/Library';
import type { DcLayout, Row } from '../../domain/layout/types';
import { tileWidthOf, type DesignLookup } from '../../domain/layout/tiles';
import { computeRackMetrics } from '../../domain/design/metrics';
import { formatPower } from '../../domain/units';
import type { LayoutSelection } from './selection';
import { paint } from '../../theme/paint';

interface Props {
  lib: Library;
  designs: DesignLookup;
  layout: DcLayout;
  row: Row;
  selection?: LayoutSelection;
  onSelect(sel: LayoutSelection): void;
}

/** One row: tiles, assigned racks (name + power), and front-side marker. */
export function RowDrawing({ lib, designs, layout, row, selection, onSelect }: Props) {
  const tiles = Array.from({ length: row.tileCount }, (_, i) => i);
  const assignments = layout.assignments.filter((a) => a.rowId === row.id);
  const frontY = row.frontFacing === 'south' ? row.y + row.tileDepthMm : row.y;
  const rowSelected = selection?.kind === 'row' && selection.id === row.id;
  return (
    <g>
      <text x={row.x - 80} y={row.y + row.tileDepthMm / 2 + 60} fontSize={180} textAnchor="end" fontWeight={700}
        fill={rowSelected ? paint.selection : paint.ink} style={{ cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); onSelect({ kind: 'row', id: row.id }); }}>
        {row.name}
      </text>
      {tiles.map((t) => {
        const sel = selection?.kind === 'tile' && selection.rowId === row.id && selection.tile === t;
        return (
          <rect key={t} x={row.x + t * row.tileWidthMm} y={row.y} width={row.tileWidthMm} height={row.tileDepthMm}
            fill={sel ? paint.selection : paint.slot} fillOpacity={sel ? 0.5 : 1} stroke={rowSelected ? paint.selection : paint.inkMuted} strokeOpacity={rowSelected ? 1 : 0.5} strokeWidth={12}
            style={{ cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); onSelect({ kind: 'tile', rowId: row.id, tile: t }); }} />
        );
      })}
      <line x1={row.x} x2={row.x + row.tileCount * row.tileWidthMm} y1={frontY} y2={frontY} stroke={paint.accent} strokeWidth={50} />
      {assignments.map((a) => {
        const design = designs(a.designId);
        const n = tileWidthOf(lib, design);
        const x = row.x + a.startTile * row.tileWidthMm;
        const w = n * row.tileWidthMm;
        const power = design ? computeRackMetrics(lib, design).typicalW : 0;
        const sel = selection?.kind === 'assignment' && selection.id === a.id;
        // Text is rotated along the rack depth; two lines must fit across the rack width.
        const font = Math.min(160, (w - 60) * 0.32);
        return (
          <g key={a.id} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelect({ kind: 'assignment', id: a.id }); }}>
            <title>{`${a.label} — ${design?.name ?? a.designId} — ${formatPower(power)}`}</title>
            <rect x={x + 30} y={row.y + 30} width={w - 60} height={row.tileDepthMm - 60} rx={40}
              fill={paint.accent} stroke={sel ? paint.selection : paint.ink} strokeWidth={sel ? 60 : 20} />
            <g transform={`translate(${x + w / 2} ${row.y + row.tileDepthMm / 2}) rotate(-90)`}>
              <text y={-font * 0.4} fontSize={font} textAnchor="middle" fill={paint.onAccent} fontWeight={700}>{a.label}</text>
              <text y={font * 0.8} fontSize={font * 0.8} textAnchor="middle" fill={paint.onAccent} opacity={0.8}>{formatPower(power)}</text>
            </g>
          </g>
        );
      })}
    </g>
  );
}
