import type { DcLayout } from '../../domain/layout/types';
import { Button } from '../../ui/button';
import type { LayoutEditor } from './use-layout-editor';
import type { ElementKind, ElementSelection, LayoutSelection } from './selection';
import { RowForm } from './row-form';
import { AisleForm, FacilityForm, TrayForm } from './area-forms';

const NAMES: Record<ElementKind, [string, string]> = {
  row: ['row', 'rows'], aisle: ['aisle', 'aisles'], tray: ['tray', 'trays'], facility: ['facility', 'facilities'],
};

/** "Select all" shortcuts over the layout, e.g. all cold aisles. */
function groupsOf(layout: DcLayout): { label: string; sel: ElementSelection }[] {
  const g = (label: string, kind: ElementKind, ids: string[]) => ({ label: `${label} (${ids.length})`, sel: { kind, ids } });
  return [
    g('All rows', 'row', layout.rows.map((r) => r.id)),
    g('Cold aisles', 'aisle', layout.aisles.filter((a) => a.kind === 'cold').map((a) => a.id)),
    g('Hot aisles', 'aisle', layout.aisles.filter((a) => a.kind === 'hot').map((a) => a.id)),
    g('All trays', 'tray', layout.trays.map((t) => t.id)),
    g('Facilities', 'facility', layout.facilities.map((f) => f.id)),
  ].filter((x) => x.sel.ids.length > 0);
}

export function SelectGroups({ layout, onSelect }: { layout: DcLayout; onSelect(sel: LayoutSelection): void }) {
  const groups = groupsOf(layout);
  if (!groups.length) return null;
  return (
    <div className="toolbar-group">
      {groups.map((x) => <Button key={x.label} onClick={() => onSelect(x.sel)}>{x.label}</Button>)}
    </div>
  );
}

/** Editor for one or more selected elements of one kind; edits apply to all of them. */
export function ElementPanel({ layout, editor, selection, onSelect }: {
  layout: DcLayout; editor: LayoutEditor; selection: ElementSelection; onSelect(sel: LayoutSelection | undefined): void;
}) {
  const { kind, ids } = selection;
  const pick = <T extends { id: string }>(xs: T[]) => xs.filter((x) => ids.includes(x.id));
  const n = ids.length;
  const list = ({ row: 'rows', aisle: 'aisles', tray: 'trays', facility: 'facilities' } as const)[kind];
  return (
    <div className="card">
      <strong>{n === 1 ? `1 ${NAMES[kind][0]}` : `${n} ${NAMES[kind][1]} — changes apply to all`}</strong>
      {kind === 'row' && <RowForm rows={pick(layout.rows)} editor={editor} />}
      {kind === 'aisle' && <AisleForm aisles={pick(layout.aisles)} editor={editor} />}
      {kind === 'tray' && <TrayForm trays={pick(layout.trays)} layout={layout} editor={editor} />}
      {kind === 'facility' && <FacilityForm facilities={pick(layout.facilities)} editor={editor} />}
      <div className="row2">
        <Button onClick={() => onSelect({ kind, ids: editor.duplicate(kind, ids) })}>Duplicate</Button>
        <Button variant="danger" onClick={() => { editor.removeElements(list, ids); onSelect(undefined); }}>Delete</Button>
      </div>
    </div>
  );
}
