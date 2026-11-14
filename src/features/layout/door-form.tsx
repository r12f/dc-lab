import type { DcLayout, Door, Wall } from '../../domain/layout/types';
import { WALLS, wallLength } from '../../domain/layout/doors';
import type { LayoutEditor } from './use-layout-editor';
import { BatchNumber, BatchSelect, BatchText, common } from './batch-fields';

const wallOptions = WALLS.map((w) => ({ value: w, label: w[0].toUpperCase() + w.slice(1) }));
const kindOptions: { value: Door['kind']; label: string }[] = [{ value: 'entry', label: 'Entry' }, { value: 'exit', label: 'Exit / other' }];

/** Edits one or several doors; offset is from the west end (north/south walls) or north end (east/west walls). */
export function DoorForm({ doors, layout, editor }: { doors: Door[]; layout: DcLayout; editor: LayoutEditor }) {
  const ids = doors.map((d) => d.id);
  const set = (patch: Partial<Door>) => {
    editor.updateElements<Door>('doors', ids, patch);
    for (const d of doors) editor.moveDoor(d.id, patch.wall ?? d.wall, patch.offsetMm ?? d.offsetMm);
  };
  const one = doors.length === 1 ? doors[0] : undefined;
  return (
    <>
      <div className="row2">
        {one && <BatchText label="Name" value={one.name} onChange={(name) => set({ name })} />}
        <BatchSelect<Door['kind']> label="Kind" value={common(doors, 'kind')} options={kindOptions} onChange={(kind) => set({ kind })} />
      </div>
      <div className="row3">
        <BatchSelect<Wall> label="Wall" value={common(doors, 'wall')} options={wallOptions} onChange={(wall) => set({ wall })} />
        {one && <BatchNumber label={`Offset mm (of ${wallLength(layout, one.wall)})`} value={one.offsetMm} min={0} onChange={(offsetMm) => set({ offsetMm })} />}
        <BatchNumber label="Width mm" value={common(doors, 'widthMm')} min={600} onChange={(widthMm) => set({ widthMm })} />
      </div>
      <p className="muted">Drag a door along the walls; it snaps to the nearest wall.</p>
    </>
  );
}
