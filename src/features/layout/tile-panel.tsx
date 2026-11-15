import { useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import { assignmentAt, formatTiles, tileWidthOf, type DesignLookup } from '../../domain/layout/tiles';
import { computeRackMetrics } from '../../domain/design/metrics';
import { formatPower } from '../../domain/units';
import { useAppStore } from '../../state/store';
import { Button } from '../../ui/button';
import { SelectField, TextField } from '../../ui/fields';
import type { LayoutEditor } from './use-layout-editor';
import type { LayoutSelection, TileSelection } from './selection';
import type { RackAssignment } from '../../domain/layout/types';
import { assignmentRole, infraGroups, servedRacks } from '../../domain/layout/infra';

/** Which IT racks a power / CDU rack serves (default: adjacent), and its group's capacity vs load. */
function ServesEditor({ lib, designs, layout, editor, infra }: {
  lib: Library; designs: DesignLookup; layout: DcLayout; editor: LayoutEditor; infra: RackAssignment;
}) {
  const role = assignmentRole(lib, designs, infra);
  if (role === 'it' || role === 'chiller') return null;
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

/** Assign a rack design to the selected tile(s), or edit the selected assignment. */
export function TilePanel({ lib, designs, layout, editor, selection, onSelect }: Props) {
  const allDesigns = useAppStore((s) => s.project.rackDesigns);
  const [designId, setDesignId] = useState(allDesigns[0]?.id ?? '');
  const [message, setMessage] = useState<{ error: boolean; lines: string[] }>();

  // One tile covered by a rack: edit that rack.
  const single = selection.kind === 'tile' && selection.tiles.length === 1 ? selection.tiles[0] : undefined;
  const assignment = selection.kind === 'assignment'
    ? layout.assignments.find((a) => a.id === selection.id)
    : single && assignmentAt(lib, designs, layout, single.rowId, single.tile);

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
  if (allDesigns.length === 0) return <p className="muted">Create a rack design in Rack Designer first.</p>;
  const sel: TileSelection = selection;
  const free = sel.tiles.filter((t) => !assignmentAt(lib, designs, layout, t.rowId, t.tile));
  const rowName = (id: string) => layout.rows.find((r) => r.id === id)?.name ?? id;
  const title = sel.tiles.length === 1
    ? `${rowName(sel.tiles[0].rowId)} · tile ${sel.tiles[0].tile + 1}`
    : `${sel.tiles.length} tiles selected · ${free.length} free`;
  const assign = () => {
    const r = editor.assignTiles(sel.tiles, designId);
    if (r.ids.length) onSelect(undefined);
    setMessage(r.skipped.length
      ? { error: r.ids.length === 0, lines: [`${r.ids.length} rack${r.ids.length === 1 ? '' : 's'} assigned; skipped:`, ...r.skipped] }
      : { error: false, lines: [`${r.ids.length} rack${r.ids.length === 1 ? '' : 's'} assigned`] });
  };
  return (
    <div className="card">
      <strong>{title}</strong>
      <p className="muted">Ctrl/Shift-click tiles to add or remove them; Shift-click selects a run in the row.</p>
      <SelectField label="Rack design" value={designId}
        options={allDesigns.map((d) => ({ value: d.id, label: `${d.abbr} · ${d.name} (${formatTiles(tileWidthOf(lib, d))} tiles)` }))}
        onChange={setDesignId} />
      {message && message.lines.map((l, i) => <p key={i} className={message.error ? 'error' : 'muted'}>{l}</p>)}
      <Button variant="primary" disabled={!designId || free.length === 0} onClick={assign}>
        {free.length > 1 ? `Assign ${free.length} racks` : 'Assign rack'}
      </Button>
    </div>
  );
}
