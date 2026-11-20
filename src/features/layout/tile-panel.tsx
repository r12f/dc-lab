import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import { assignmentAt, formatTiles, tileWidthOf, type DesignLookup } from '../../domain/layout/tiles';
import { computeRackMetrics } from '../../domain/design/metrics';
import { formatPower } from '../../domain/units';
import { Button } from '../../ui/button';
import { TextField } from '../../ui/fields';
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
export function TilePanel({ lib, designs, layout, editor, selection }: Props) {
  // One tile covered by a rack: edit that rack.
  const single = selection.kind === 'tile' && selection.tiles.length === 1 ? selection.tiles[0] : undefined;
  const assignment = selection.kind === 'assignment'
    ? selection.ids.length === 1 ? layout.assignments.find((a) => a.id === selection.ids[0]) : undefined
    : single && assignmentAt(lib, designs, layout, single.rowId, single.tile);

  if (selection.kind === 'assignment' && selection.ids.length > 1) {
    return <RacksPanel lib={lib} designs={designs} layout={layout} ids={selection.ids} />;
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
      </div>
    );
  }
  if (selection.kind !== 'tile') return null;
  const sel: TileSelection = selection;
  const free = sel.tiles.filter((t) => !assignmentAt(lib, designs, layout, t.rowId, t.tile));
  const rowName = (id: string) => layout.rows.find((r) => r.id === id)?.name ?? id;
  const title = sel.tiles.length === 1
    ? `${rowName(sel.tiles[0].rowId)} · tile ${sel.tiles[0].tile + 1}`
    : `${sel.tiles.length} tiles selected · ${free.length} free`;
  return (
    <div className="card">
      <strong>{title}</strong>
      <p className="muted">Ctrl-click tiles to add or remove them; Shift-click selects the run from the last tile in that row.</p>
    </div>
  );
}

/** Several racks selected: list them. */
function RacksPanel({ lib, designs, layout, ids }: {
  lib: Library; designs: DesignLookup; layout: DcLayout; ids: string[];
}) {
  const racks = layout.assignments.filter((a) => ids.includes(a.id));
  const kw = racks.reduce((n, a) => { const d = designs(a.designId); return n + (d ? computeRackMetrics(lib, d).typicalW : 0); }, 0);
  return (
    <div className="card">
      <strong>{`${racks.length} racks selected · ${formatPower(kw)}`}</strong>
      <p className="muted">{racks.map((a) => a.label).join(', ')}</p>
      <p className="muted">Ctrl/Shift-click racks to add or remove them.</p>
    </div>
  );
}
