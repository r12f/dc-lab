import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { Button } from '../../ui/button';
import { NumberField, Section, TextField } from '../../ui/fields';
import type { LayoutEditor } from './use-layout-editor';
import type { LayoutSelection } from './selection';
import { RowForm } from './row-form';
import { AisleForm, FacilityForm, RectFields, TrayForm } from './area-forms';
import { floorWarnings } from '../../domain/layout/floor-plan';
import { TilePanel } from './tile-panel';
import { DcSummaryPanel } from './dc-summary-panel';

interface Props {
  lib: Library;
  designs: DesignLookup;
  layout: DcLayout;
  editor: LayoutEditor;
  selection?: LayoutSelection;
  onSelect(sel: LayoutSelection | undefined): void;
}

function SelectionEditor({ lib, designs, layout, editor, selection, onSelect }: Props) {
  if (!selection) return <p className="muted">Click a tile, rack, row name, aisle, tray or facility.</p>;
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
      return t ? <TrayForm tray={t} layout={layout} editor={editor} onRemoved={clear} /> : null;
    }
    case 'facility': {
      const f = layout.facilities.find((x) => x.id === selection.id);
      return f ? <FacilityForm facility={f} editor={editor} onRemoved={clear} /> : null;
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
      </Section>
      <Section title="Rack area">
        <RectFields rect={layout.whitespace} onChange={(p) => editor.setWhitespace({ ...layout.whitespace, ...p })} />
        <p className="muted">Rows and aisles pack west to east inside it; drag them sideways to reorder.</p>
        <div className="row3">
          <Button onClick={editor.addRow}>+ Row</Button>
          <Button onClick={editor.addAisle}>+ Aisle</Button>
          <Button onClick={() => editor.addTray(props.selection?.kind === 'aisle' ? props.selection.id : undefined)}>+ Tray</Button>
        </div>
      </Section>
      <Section title="Facilities">
        <div className="row3">
          <Button onClick={() => editor.addFacility('pdu')}>+ PDU</Button>
          <Button onClick={() => editor.addFacility('cooling')}>+ Cooling</Button>
          <Button onClick={() => editor.addFacility('other')}>+ Other</Button>
        </div>
      </Section>
      {floorWarnings(layout).map((w) => <p key={w} className="warn">{w}</p>)}
      <Section title="Selection">
        <SelectionEditor {...props} />
      </Section>
      <DcSummaryPanel {...props} />
    </div>
  );
}
