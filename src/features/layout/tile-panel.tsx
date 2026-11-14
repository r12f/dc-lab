import { useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import { assignmentAt, assignmentProblem, type DesignLookup } from '../../domain/layout/tiles';
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
        <p className="muted">{`${d?.name ?? assignment.designId} · tile ${assignment.startTile + 1} · ${m ? formatPower(m.typicalW) : ''}`}</p>
        <Button variant="danger" onClick={() => { editor.unassign(assignment.id); onSelect(undefined); }}>Remove rack</Button>
      </div>
    );
  }
  if (selection.kind !== 'tile') return null;
  const row = layout.rows.find((r) => r.id === selection.rowId);
  if (!row) return null;
  if (allDesigns.length === 0) return <p className="muted">Create a rack design in Rack Designer first.</p>;
  const problem = designId ? assignmentProblem(lib, designs, layout, row, selection.tile, designId) : 'Pick a design';
  return (
    <div className="card">
      <strong>{`${row.name} · tile ${selection.tile + 1}`}</strong>
      <SelectField label="Rack design" value={designId}
        options={allDesigns.map((d) => ({ value: d.id, label: `${d.name} (${lib.racks.get(d.templateId)?.footprintTiles.wide ?? 1} tile)` }))}
        onChange={setDesignId} />
      {(error || problem) && <p className="error">{error ?? problem}</p>}
      <Button variant="primary" disabled={!!problem} onClick={() => setError(editor.assign(row.id, selection.tile, designId))}>
        Assign rack
      </Button>
    </div>
  );
}
