import type { RackTemplate } from '../../domain/rack/types';
import {
  elementsOn, newSideElement, SIDE_ELEMENT_KINDS, SIDE_KINDS,
  type SideElement, type SideElementKind, type SideName,
} from '../../domain/rack/sideElements';
import { uniqueId } from '../../domain/ids';
import { Button } from '../../ui/Button';
import { NumberField, Section, SelectField, TextField } from '../../ui/fields';
import { useState } from 'react';

interface Props {
  rack: RackTemplate;
  onChange(rack: RackTemplate): void;
  selectedId?: string;
  onSelect(id: string | undefined): void;
}

const kindOptions = SIDE_ELEMENT_KINDS.map((k) => ({ value: k, label: SIDE_KINDS[k].label }));

function ElementForm({ el, set }: { el: SideElement; set(patch: Partial<SideElement>): void }) {
  return (
    <>
      <div className="row2">
        <TextField label="Name" value={el.name} onChange={(name) => set({ name })} />
        <SelectField<SideElementKind> label="Kind" value={el.kind} options={kindOptions} onChange={(kind) => set({ kind })} />
      </div>
      <div className="row3">
        <NumberField label="Width mm" value={el.widthMm} min={10} onChange={(widthMm) => set({ widthMm })} />
        <NumberField label="Depth mm" value={el.depthMm} min={10} onChange={(depthMm) => set({ depthMm })} />
        <NumberField label="Slots" value={el.slots} min={0} onChange={(slots) => set({ slots })} />
      </div>
      <NumberField label="Weight kg" value={el.weightKg} min={0} onChange={(weightKg) => set({ weightKg })} />
    </>
  );
}

/** Add, edit, reorder and remove boxes on each side of the rack. */
export function SideElementsEditor({ rack, onChange, selectedId, onSelect }: Props) {
  const [kind, setKind] = useState<SideElementKind>('sidepod');
  const list = rack.sideElements;
  const setList = (sideElements: SideElement[]) => onChange({ ...rack, sideElements });
  const add = (side: SideName) => {
    const el = newSideElement(uniqueId(`${kind}-${side}`, list.map((e) => e.id)), kind, side, rack.depthMm);
    setList([...list, el]);
    onSelect(el.id);
  };
  const update = (id: string, patch: Partial<SideElement>) => setList(list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  /** Swaps with the neighbour on the same side; -1 = toward the rack body. */
  const move = (el: SideElement, dir: -1 | 1) => {
    const same = elementsOn(list, el.side);
    const other = same[same.indexOf(el) + dir];
    if (!other) return;
    const a = list.indexOf(el);
    const b = list.indexOf(other);
    const next = [...list];
    [next[a], next[b]] = [next[b], next[a]];
    setList(next);
  };

  return (
    <Section title="Side elements">
      <div className="row3">
        <SelectField<SideElementKind> label="New kind" value={kind} options={kindOptions} onChange={setKind} />
        <Button onClick={() => add('left')}>+ Left</Button>
        <Button onClick={() => add('right')}>+ Right</Button>
      </div>
      {list.length === 0 && <p className="muted">No side elements. Add sidepods, PDU bays or cable managers.</p>}
      {(['left', 'right'] as const).map((side) => elementsOn(list, side).map((el, i, same) => (
        <details key={el.id} className="card" open={el.id === selectedId}
          onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && onSelect(el.id)}>
          <summary>{`${side === 'left' ? 'L' : 'R'}${i + 1} · ${el.name} · ${el.widthMm} mm · ${el.slots} slot(s)`}</summary>
          <ElementForm el={el} set={(patch) => update(el.id, patch)} />
          <div className="row3">
            <Button disabled={i === 0} onClick={() => move(el, -1)} title="Move toward the rack body">Inward</Button>
            <Button disabled={i === same.length - 1} onClick={() => move(el, 1)} title="Move away from the rack body">Outward</Button>
            <Button variant="danger" onClick={() => { setList(list.filter((x) => x.id !== el.id)); onSelect(undefined); }}>Remove</Button>
          </div>
        </details>
      )))}
    </Section>
  );
}
