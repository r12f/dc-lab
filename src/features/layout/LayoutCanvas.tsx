import type { Ref } from 'react';
import type { Library } from '../../domain/library/Library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import type { LayoutSelection } from './selection';
import { RowDrawing } from './RowDrawing';
import { AreaDrawing } from './AreaDrawing';

interface Props {
  ref?: Ref<SVGSVGElement>;
  lib: Library;
  designs: DesignLookup;
  layout: DcLayout;
  selection?: LayoutSelection;
  onSelect(sel: LayoutSelection | undefined): void;
}

/** Room plan drawn in millimetres (1 SVG unit = 1 mm). */
export function LayoutCanvas({ ref, lib, designs, layout, selection, onSelect }: Props) {
  const { widthMm, depthMm } = layout.room;
  const pad = 600;
  const pxPerMm = Math.min(1400 / widthMm, 0.1);
  return (
    <svg ref={ref} viewBox={`${-pad} ${-pad} ${widthMm + pad * 2} ${depthMm + pad * 2}`}
      width={(widthMm + pad * 2) * pxPerMm} className="drawing">
      <rect x={-pad} y={-pad} width={widthMm + pad * 2} height={depthMm + pad * 2} fill="#fff" onClick={() => onSelect(undefined)} />
      <text x={0} y={-200} fontSize={260} fontWeight={700} fill="#0f172a">{layout.name}</text>
      <rect x={0} y={0} width={widthMm} height={depthMm} fill="#f8fafc" stroke="#0f172a" strokeWidth={40}
        onClick={() => onSelect(undefined)} />
      {layout.aisles.map((a) => (
        <AreaDrawing key={a.id} rect={a} fill={a.kind === 'cold' ? '#bfdbfe' : '#fecaca'} label={`${a.kind} aisle`}
          selected={selection?.kind === 'aisle' && selection.id === a.id} onClick={() => onSelect({ kind: 'aisle', id: a.id })} />
      ))}
      {layout.trays.map((t) => (
        <AreaDrawing key={t.id} rect={t} fill={t.kind === 'data' ? '#fde68a' : '#d4d4d8'} label={`${t.kind} tray`} dashed
          selected={selection?.kind === 'tray' && selection.id === t.id} onClick={() => onSelect({ kind: 'tray', id: t.id })} />
      ))}
      {layout.rows.map((r) => (
        <RowDrawing key={r.id} lib={lib} designs={designs} layout={layout} row={r} selection={selection} onSelect={onSelect} />
      ))}
    </svg>
  );
}
