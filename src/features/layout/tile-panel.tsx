import { useState } from 'react';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import { assignmentAt, formatTiles, tileWidthOf, type DesignLookup } from '../../domain/layout/tiles';
import { computeRackMetrics } from '../../domain/design/metrics';
import { formatPower } from '../../domain/units';
import { useAppStore } from '../../state/store';
import { Button } from '../../ui/button';
import { NumberField, SelectField, TextField } from '../../ui/fields';
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
    ? selection.ids.length === 1 ? layout.assignments.find((a) => a.id === selection.ids[0]) : undefined
    : single && assignmentAt(lib, designs, layout, single.rowId, single.tile);

  if (selection.kind === 'assignment' && selection.ids.length > 1) {
    return <RacksPanel lib={lib} designs={designs} layout={layout} editor={editor} ids={selection.ids} onSelect={onSelect} />;
  }

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
        <RackMoveFields editor={editor} ids={[assignment.id]} designId={assignment.designId} />
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
      <p className="muted">Ctrl-click tiles to add or remove them; Shift-click selects the run from the last tile in that row.</p>
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

/**
 * Move the selected racks by rows (row order, across row blocks) and tiles, or swap their design in place. Moves are
 * all-or-none; dragging a selected rack on the canvas does the same.
 */
function RackMoveFields({ editor, ids, designId }: { editor: LayoutEditor; ids: string[]; designId?: string }) {
  const allDesigns = useAppStore((s) => s.project.rackDesigns);
  const [rows, setRows] = useState(0);
  const [tiles, setTiles] = useState(0);
  const [to, setTo] = useState(designId ?? allDesigns[0]?.id ?? '');
  const [msg, setMsg] = useState<{ error: boolean; lines: string[] }>();
  const move = (dRow: number, dTile: number) => {
    const e = editor.moveRacks(ids, dRow, dTile);
    setMsg(e ? { error: true, lines: [e] } : undefined);
  };
  const change = () => {
    const r = editor.changeDesign(ids, to);
    setMsg({ error: r.changed === 0 && r.skipped.length > 0, lines: [`${r.changed} rack${r.changed === 1 ? '' : 's'} changed`, ...r.skipped] });
  };
  return (
    <div className="subcard">
      <strong>Move</strong>
      <div className="row-actions">
        <Button title="One tile north" onClick={() => move(0, -1)}>↑ tile</Button>
        <Button title="One tile south" onClick={() => move(0, 1)}>↓ tile</Button>
        <Button title="Previous row (west / block above)" onClick={() => move(-1, 0)}>← row</Button>
        <Button title="Next row (east / block below)" onClick={() => move(1, 0)}>→ row</Button>
      </div>
      <div className="row3">
        <NumberField label="Rows (+ next)" value={rows} onChange={setRows} />
        <NumberField label="Tiles (+ south)" value={tiles} onChange={setTiles} />
        <Button onClick={() => move(rows, tiles)}>Move</Button>
      </div>
      <p className="muted">Or drag a selected rack on the canvas: the selection moves with it, all or none.</p>
      <div className="row2">
        <SelectField label="Design" value={to} options={allDesigns.map((d) => ({ value: d.id, label: `${d.abbr} · ${d.name}` }))} onChange={setTo} />
        <Button onClick={change}>Change design</Button>
      </div>
      {msg && msg.lines.map((l, i) => <p key={i} className={msg.error ? 'error' : 'muted'}>{l}</p>)}
    </div>
  );
}

/** Several racks selected: list them, move them together, swap their design, or remove them. */
function RacksPanel({ lib, designs, layout, editor, ids, onSelect }: {
  lib: Library; designs: DesignLookup; layout: DcLayout; editor: LayoutEditor; ids: string[]; onSelect(sel: LayoutSelection | undefined): void;
}) {
  const racks = layout.assignments.filter((a) => ids.includes(a.id));
  const kw = racks.reduce((n, a) => { const d = designs(a.designId); return n + (d ? computeRackMetrics(lib, d).typicalW : 0); }, 0);
  return (
    <div className="card">
      <strong>{`${racks.length} racks selected · ${formatPower(kw)}`}</strong>
      <p className="muted">{racks.map((a) => a.label).join(', ')}</p>
      <p className="muted">Ctrl/Shift-click racks to add or remove them.</p>
      <RackMoveFields editor={editor} ids={ids} designId={racks.every((a) => a.designId === racks[0]?.designId) ? racks[0]?.designId : undefined} />
      <Button variant="danger" onClick={() => { editor.unassignAll(ids); onSelect(undefined); }}>{`Remove ${racks.length} racks`}</Button>
    </div>
  );
}
