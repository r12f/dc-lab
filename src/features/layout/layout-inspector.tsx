import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { NumberField, Section, TextField } from '../../ui/fields';
import type { LayoutEditor } from './use-layout-editor';
import { isElementSelection, type LayoutSelection } from './selection';
import { RectFields } from './area-forms';
import { ElementPanel, SelectGroups } from './element-panel';
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
  if (!selection) return <p className="muted">Click a tile, rack, row header, aisle, tray or facility. Ctrl/Shift-click to select several of one kind (tiles too, to assign racks to all of them).</p>;
  if (isElementSelection(selection)) {
    return <ElementPanel lib={lib} designs={designs} layout={layout} editor={editor} selection={selection} onSelect={onSelect} />;
  }
  return <TilePanel lib={lib} designs={designs} layout={layout} editor={editor} selection={selection} onSelect={onSelect} />;
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
      </Section>
      {floorWarnings(layout).map((w) => <p key={w} className="warn">{w}</p>)}
      <Section title="Selection">
        <SelectGroups layout={layout} onSelect={props.onSelect} />
        <SelectionEditor {...props} />
      </Section>
      <DcSummaryPanel {...props} />
    </div>
  );
}
