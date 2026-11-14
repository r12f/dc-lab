import { useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import { assignmentAt, assignmentProblem, formatTiles, startInTile, tileWidthOf, type DesignLookup } from '../../domain/layout/tiles';
import { computeRackMetrics } from '../../domain/design/metrics';
import { formatPower } from '../../domain/units';
import { useAppStore } from '../../state/store';
import { Button } from '../../ui/button';
import { SelectField, TextField } from '../../ui/fields';
import type { LayoutEditor } from './use-layout-editor';
import type { LayoutSelection } from './selection';

interface Props {
  lib: Library;
  designs: DesignLookup;
  layout: DcLayout;
  editor: LayoutEditor;
  selection: Extract<LayoutSelection, { kind: 'tile' | 'assignment' }>;
  onSelect(sel: LayoutSelection | undefined): void;
}

/** Assign a rack design to the selected tile, or edit the selected assignment. */
export function TilePanel({ lib, designs, layout, editor, selection, onSelect }: Props) {
  const allDesigns = useAppStore((s) => s.project.rackDesigns);
  const [designId, setDesignId] = useState(allDesigns[0]?.id ?? '');
  const [error, setError] = useState<string>();

  const assignment = selection.kind === 'assignment'
    ? layout.assignments.find((a) => a.id === selection.id)
    : assignmentAt(lib, designs, layout, selection.rowId, selection.tile);

  if (assignment) {
    const d = designs(assignment.designId);
    const m = d && computeRackMetrics(lib, d);
    return (
      <div className="card">
        <TextField label="Rack label" value={assignment.label} onChange={(v) => editor.relabel(assignment.id, v)} />
        <p className="muted">{`${d?.name ?? assignment.designId} · tiles ${formatTiles(assignment.startTile + 1)}–${formatTiles(assignment.startTile + tileWidthOf(lib, d))} · ${m ? formatPower(m.typicalW) : ''}`}</p>
        <Button variant="danger" onClick={() => { editor.unassign(assignment.id); onSelect(undefined); }}>Remove rack</Button>
      </div>
    );
  }
  if (selection.kind !== 'tile') return null;
  const row = layout.rows.find((r) => r.id === selection.rowId);
  if (!row) return null;
  if (allDesigns.length === 0) return <p className="muted">Create a rack design in Rack Designer first.</p>;
  // A tile partly filled by a fractional-width rack (e.g. 1.5-tile ORv3) starts the next rack where that one ends.
  const start = startInTile(lib, designs, layout, row.id, selection.tile);
  const problem = designId ? assignmentProblem(lib, designs, layout, row, start, designId) : 'Pick a design';
  return (
    <div className="card">
      <strong>{`${row.name} · tile ${selection.tile + 1}${start !== selection.tile ? ` (free from ${formatTiles(start + 1)})` : ''}`}</strong>
      <SelectField label="Rack design" value={designId}
        options={allDesigns.map((d) => ({ value: d.id, label: `${d.name} (${formatTiles(tileWidthOf(lib, d))} tiles)` }))}
        onChange={setDesignId} />
      {(error || problem) && <p className="error">{error ?? problem}</p>}
      <Button variant="primary" disabled={!!problem} onClick={() => setError(editor.assign(row.id, start, designId))}>
        Assign rack
      </Button>
    </div>
  );
}
