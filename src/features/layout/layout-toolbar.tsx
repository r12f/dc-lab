import { Button } from '../../ui/button';
import type { LayoutEditor } from './use-layout-editor';
import { isElementSelection, type ElementKind, type LayoutSelection } from './selection';
import type { DcLayout } from '../../domain/layout/types';
import { insertAnchor } from '../../domain/layout/insert';

interface Props {
  layout: DcLayout;
  editor: LayoutEditor;
  selection?: LayoutSelection;
  onSelect(sel: LayoutSelection | undefined): void;
}

/** Canvas title-bar actions: add rows/aisles/trays/facilities, duplicate or delete the selection. */
export function LayoutToolbar({ layout, editor, selection, onSelect }: Props) {
  const elements = isElementSelection(selection) ? selection : undefined;
  // New elements go after the selection; the new element becomes the selection, so repeated clicks chain.
  const anchor = insertAnchor(layout, selection);
  const added = (kind: ElementKind, id: string | undefined) => { if (id) onSelect({ kind, ids: [id] }); };
  const list = elements && ({ row: 'rows', aisle: 'aisles', tray: 'trays', facility: 'facilities' } as const)[elements.kind];
  return (
    <div className="toolbar-group">
      <Button title="After the selected row/aisle, else at the east end" onClick={() => added('row', editor.addRow(anchor))}>+ Row</Button>
      <Button title="After the selected row/aisle, else at the east end" onClick={() => added('aisle', editor.addAisle(anchor))}>+ Aisle</Button>
      <Button title="Over the selected aisle, else the next aisle east of the selection" onClick={() => added('tray', editor.addTray(anchor))}>+ Tray</Button>
      <Button title="Next to the selected facility" onClick={() => added('facility', editor.addFacility('pdu', anchor))}>+ PDU</Button>
      <Button title="Next to the selected facility" onClick={() => added('facility', editor.addFacility('cooling', anchor))}>+ Cooling</Button>
      <span className="toolbar-sep" />
      <Button disabled={!elements} title="Ctrl+D"
        onClick={() => elements && onSelect({ kind: elements.kind, ids: editor.duplicate(elements.kind, elements.ids) })}>
        {`Duplicate${elements && elements.ids.length > 1 ? ` (${elements.ids.length})` : ''}`}
      </Button>
      <Button variant="danger" disabled={!elements} title="Delete"
        onClick={() => { if (elements && list) { editor.removeElements(list, elements.ids); onSelect(undefined); } }}>Delete</Button>
    </div>
  );
}
