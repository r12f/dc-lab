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
import type { RackAssignment } from '../../domain/layout/types';
import { assignmentRole, infraGroups, servedRacks } from '../../domain/layout/infra';

/** Which IT racks a power / CDU rack serves (default: adjacent), and its group's capacity vs load. */
function ServesEditor({ lib, designs, layout, editor, infra }: {
  lib: Library; designs: DesignLookup; layout: DcLayout; editor: LayoutEditor; infra: RackAssignment;
}) {
  const role = assignmentRole(lib, designs, infra);
  if (role === 'it') return null;
  const served = new Set(servedRacks(lib, designs, layout, infra).map((a) => a.id));
  const it = layout.assignments.filter((a) => assignmentRole(lib, designs, a) === 'it');
  const g = infraGroups(lib, designs, layout, role).find((x) => x.infraIds.includes(infra.id));
  const rowName = (id: string) => layout.rows.find((r) => r.id === id)?.name ?? '';
  const toggle = (id: string) => {
    const next = new Set(served);
    if (next.has(id)) next.delete(id); else next.add(id);
    editor.setServes(infra.id, [...next]);
  };
  return (
    <div className="card">
      <strong>{`Serves (${role === 'power' ? 'power' : 'cooling'})`}</strong>
      <p className="muted">{infra.serves ? 'Picked by hand.' : 'Default: the adjacent IT racks in this row.'}</p>
      {it.map((a) => (
        <label key={a.id} className="checkbox" style={{ display: 'block' }}>
          <input type="checkbox" checked={served.has(a.id)} onChange={() => toggle(a.id)} />
          {` ${a.label} · ${rowName(a.rowId)}`}
        </label>
      ))}
      {infra.serves && <Button onClick={() => editor.setServes(infra.id, undefined)}>Use adjacent racks</Button>}
      {g && (
        <p className={g.ok ? 'muted' : 'error'}>
          {`Group ${g.infraIds.length > 1 ? `(${g.infraIds.length} racks) ` : ''}${role === 'power' ? 'supply' : 'cooling'} ${g.capacityKw.toFixed(1)} kW vs IT max ${g.loadKw.toFixed(1)} kW`}
        </p>
      )}
    </div>
  );
}

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
        <p className="muted">{`${d ? `${d.abbr} · ${d.name}` : assignment.designId} · tiles ${formatTiles(assignment.startTile + 1)}–${formatTiles(assignment.startTile + tileWidthOf(lib, d))} · ${m ? formatPower(m.typicalW) : ''}`}</p>
        {assignmentRole(lib, designs, assignment) !== 'it' && (
          <ServesEditor lib={lib} designs={designs} layout={layout} editor={editor} infra={assignment} />
        )}
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
        options={allDesigns.map((d) => ({ value: d.id, label: `${d.abbr} · ${d.name} (${formatTiles(tileWidthOf(lib, d))} tiles)` }))}
        onChange={setDesignId} />
      {(error || problem) && <p className="error">{error ?? problem}</p>}
      <Button variant="primary" disabled={!!problem} onClick={() => setError(editor.assign(row.id, start, designId))}>
        Assign rack
      </Button>
    </div>
  );
}
