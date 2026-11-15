import { useEffect, useRef, useState } from 'react';
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

/** Canvas title-bar edit actions: "+ Add ▾" (rows, aisles, trays, facilities, doors), duplicate, delete. */
export function LayoutToolbar({ layout, editor, selection, onSelect }: Props) {
  const elements = isElementSelection(selection) ? selection : undefined;
  // New elements go after the selection; the new element becomes the selection, so repeated adds chain.
  const anchor = insertAnchor(layout, selection);
  const added = (kind: ElementKind, id: string | undefined) => { if (id) onSelect({ kind, ids: [id] }); };
  const list = elements && ({ row: 'rows', aisle: 'aisles', tray: 'trays', facility: 'facilities', door: 'doors' } as const)[elements.kind];
  const items: { label: string; hint: string; run(): void }[] = [
    { label: 'Row', hint: 'after the selected row / aisle, else at the east end', run: () => added('row', editor.addRow(anchor)) },
    { label: 'Aisle', hint: 'after the selected row / aisle, else at the east end', run: () => added('aisle', editor.addAisle(anchor)) },
    { label: 'Cross aisle', hint: 'across the rack area; what follows forms the next row block', run: () => added('aisle', editor.addCrossAisle(anchor)) },
    { label: 'Tray', hint: 'along the selected aisle / cross aisle, else the next aisle', run: () => added('tray', editor.addTray(anchor)) },
    { label: 'Floating tray', hint: 'across the selected rows, over the rack tops', run: () => added('tray', editor.addFloating(anchor)) },
    { label: 'PDU', hint: 'next to the selected facility', run: () => added('facility', editor.addFacility('pdu', anchor)) },
    { label: 'Cooling', hint: 'next to the selected facility', run: () => added('facility', editor.addFacility('cooling', anchor)) },
    { label: 'Door', hint: 'entry on the south wall, or next to the selected door', run: () => added('door', editor.addDoor(anchor)) },
  ];
  return (
    <div className="toolbar-group">
      <AddMenu items={items} />
      <Button disabled={!elements} title="Ctrl+D"
        onClick={() => elements && onSelect({ kind: elements.kind, ids: editor.duplicate(elements.kind, elements.ids) })}>
        {`Duplicate${elements && elements.ids.length > 1 ? ` (${elements.ids.length})` : ''}`}
      </Button>
      <Button variant="danger" disabled={!elements} title="Delete"
        onClick={() => { if (elements && list) { editor.removeElements(list, elements.ids); onSelect(undefined); } }}>Delete</Button>
    </div>
  );
}

/** View controls (right before the zoom buttons): rotate the plan 90°. */
export function LayoutViewControls({ editor }: { editor: LayoutEditor }) {
  return (
    <>
      <Button title="Rotate view 90° counter-clockwise" onClick={() => editor.rotateView(-90)}>⟲</Button>
      <Button title="Rotate view 90° clockwise (e.g. to show rows running east–west)" onClick={() => editor.rotateView(90)}>⟳ 90°</Button>
    </>
  );
}

/** "+ Add ▾": one menu of everything that can be added; closes on pick, outside click or Escape. */
function AddMenu({ items }: { items: { label: string; hint: string; run(): void }[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <span ref={root} className="dropdown">
      <Button variant="primary" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)}>+ Add ▾</Button>
      {open && (
        <div className="dropdown-menu" role="menu">
          {items.map((i) => (
            <button key={i.label} type="button" role="menuitem" className="dropdown-item" title={i.hint}
              onClick={() => { setOpen(false); i.run(); }}>
              <span>{i.label}</span><small>{i.hint}</small>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
