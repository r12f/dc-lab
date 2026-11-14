import { Button } from '../../ui/button';
import type { LayoutEditor } from './use-layout-editor';
import { isElementSelection, type LayoutSelection } from './selection';

interface Props {
  editor: LayoutEditor;
  selection?: LayoutSelection;
  onSelect(sel: LayoutSelection | undefined): void;
}

/** Canvas title-bar actions: add rows/aisles/trays/facilities, duplicate or delete the selection. */
export function LayoutToolbar({ editor, selection, onSelect }: Props) {
  const elements = isElementSelection(selection) ? selection : undefined;
  const aisleId = elements?.kind === 'aisle' ? elements.ids[0] : undefined;
  const list = elements && ({ row: 'rows', aisle: 'aisles', tray: 'trays', facility: 'facilities' } as const)[elements.kind];
  return (
    <div className="toolbar-group">
      <Button onClick={editor.addRow}>+ Row</Button>
      <Button onClick={editor.addAisle}>+ Aisle</Button>
      <Button onClick={() => editor.addTray(aisleId)} title="Over the selected aisle, else the first aisle">+ Tray</Button>
      <Button onClick={() => editor.addFacility('pdu')}>+ PDU</Button>
      <Button onClick={() => editor.addFacility('cooling')}>+ Cooling</Button>
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
