import type { Library } from '../../domain/library/Library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { Button } from '../../ui/Button';
import { NumberField, Section, TextField } from '../../ui/fields';
import type { LayoutEditor } from './useLayoutEditor';
import type { LayoutSelection } from './selection';
import { RowForm } from './RowForm';
import { AisleForm, TrayForm } from './AreaForms';
import { TilePanel } from './TilePanel';
import { DcSummaryPanel } from './DcSummaryPanel';

interface Props {
  lib: Library;
  designs: DesignLookup;
  layout: DcLayout;
  editor: LayoutEditor;
  selection?: LayoutSelection;
  onSelect(sel: LayoutSelection | undefined): void;
}

function SelectionEditor({ lib, designs, layout, editor, selection, onSelect }: Props) {
  if (!selection) return <p className="muted">Click a tile, rack, row name, aisle or tray.</p>;
  const clear = () => onSelect(undefined);
  switch (selection.kind) {
    case 'row': {
      const row = layout.rows.find((r) => r.id === selection.id);
      return row ? <RowForm row={row} editor={editor} onRemoved={clear} /> : null;
    }
    case 'aisle': {
      const a = layout.aisles.find((x) => x.id === selection.id);
      return a ? <AisleForm aisle={a} editor={editor} onRemoved={clear} /> : null;
    }
    case 'tray': {
      const t = layout.trays.find((x) => x.id === selection.id);
      return t ? <TrayForm tray={t} editor={editor} onRemoved={clear} /> : null;
    }
    case 'tile':
    case 'assignment':
      return <TilePanel lib={lib} designs={designs} layout={layout} editor={editor} selection={selection} onSelect={onSelect} />;
  }
}

export function LayoutInspector(props: Props) {
  const { layout, editor } = props;
  return (
    <div className="inspector-inner">
      <Section title="Layout">
        <TextField label="Name" value={layout.name} onChange={editor.rename} />
        <div className="row2">
          <NumberField label="Room width mm" value={layout.room.widthMm} onChange={(widthMm) => editor.setRoom({ ...layout.room, widthMm })} />
          <NumberField label="Room depth mm" value={layout.room.depthMm} onChange={(depthMm) => editor.setRoom({ ...layout.room, depthMm })} />
        </div>
        <div className="row3">
          <Button onClick={editor.addRow}>+ Row</Button>
          <Button onClick={editor.addAisle}>+ Aisle</Button>
          <Button onClick={editor.addTray}>+ Tray</Button>
        </div>
      </Section>
      <Section title="Selection">
        <SelectionEditor {...props} />
      </Section>
      <DcSummaryPanel {...props} />
    </div>
  );
}
