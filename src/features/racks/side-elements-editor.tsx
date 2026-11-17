import type { RackTemplate } from '../../domain/rack/types';
import {
  acceptsLabel, elementsOn, FACE_LABELS, newSideElement, overallWidthMm, SIDE_PRESET_IDS, SIDE_PRESETS,
  type SideElement, type SideFaces, type SideName, type SidePresetId,
} from '../../domain/rack/side-elements';
import { DEVICE_CATEGORIES, traitsOf } from '../../domain/device/categories';
import type { DeviceCategory } from '../../domain/device/types';
import { uniqueId } from '../../domain/ids';
import { Button } from '../../ui/button';
import { NumberField, Section, SelectField, TextField } from '../../ui/fields';
import { useState } from 'react';

interface Props {
  rack: RackTemplate;
  onChange(rack: RackTemplate): void;
  selectedId?: string;
  onSelect(id: string | undefined): void;
}

const presetOptions = SIDE_PRESET_IDS.map((k) => ({ value: k, label: SIDE_PRESETS[k].label }));
const faceOptions = (Object.keys(FACE_LABELS) as SideFaces[]).map((k) => ({ value: k, label: FACE_LABELS[k] }));
const ANY = 'any';
const NONE = 'none';
const SOME = 'some';
const acceptOptions = [
  { value: ANY, label: 'Any device' }, { value: NONE, label: 'Nothing (space only)' }, { value: SOME, label: 'Only these categories…' },
];
const rackCategories = DEVICE_CATEGORIES.filter((c) => !traitsOf(c).facility);

function ElementForm({ el, set }: { el: SideElement; set(patch: Partial<SideElement>): void }) {
  const mode = !el.accepts ? ANY : el.accepts.length === 0 ? NONE : SOME;
  const toggle = (c: DeviceCategory) => {
    const cur = el.accepts ?? [];
    set({ accepts: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] });
  };
  return (
    <>
      <TextField label="Name" value={el.name} onChange={(name) => set({ name })} />
      <div className="row3">
        <NumberField label="Width mm" value={el.widthMm} min={1} onChange={(widthMm) => set({ widthMm })} />
        <NumberField label="Depth mm" value={el.depthMm} min={10} onChange={(depthMm) => set({ depthMm })} />
        <NumberField label="Weight kg" value={el.weightKg} min={0} onChange={(weightKg) => set({ weightKg })} />
      </div>
      <div className="row3">
        <SelectField<SideFaces> label="Faces" value={el.faces} options={faceOptions} onChange={(faces) => set({ faces })} />
        <SelectField label="Accepts" value={mode} options={acceptOptions}
          onChange={(m) => set({ accepts: m === ANY ? undefined : m === NONE ? [] : (el.accepts?.length ? el.accepts : ['pdu']) })} />
        <NumberField label="Slots" value={el.slots} min={0} onChange={(slots) => set({ slots })} />
      </div>
      {mode === SOME && (
        <div className="check-grid">
          {rackCategories.map((c) => (
            <label key={c} className="check">
              <input type="checkbox" checked={!!el.accepts?.includes(c)} onChange={() => toggle(c)} />
              <span>{traitsOf(c).label}</span>
            </label>
          ))}
        </div>
      )}
      <label className="check" title="Between the rails and the side panel: adds no width to the rack footprint">
        <input type="checkbox" checked={!!el.inside} onChange={(e) => set({ inside: e.target.checked || undefined })} />
        <span>Inside the rack enclosure (adds no width)</span>
      </label>
    </>
  );
}

/** Add, edit, reorder and remove boxes on each side of the rack. */
export function SideElementsEditor({ rack, onChange, selectedId, onSelect }: Props) {
  const [kind, setKind] = useState<SidePresetId>('sidepod');
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
        <SelectField<SidePresetId> label="New (preset)" value={kind} options={presetOptions} onChange={setKind} />
        <Button onClick={() => add('left')}>+ Left</Button>
        <Button onClick={() => add('right')}>+ Right</Button>
      </div>
      <p className="muted">{`A side space is a box of some width: it accepts some devices (or none), is open to the front, rear or both, and adds its width to the rack unless inside the enclosure. Overall width: ${overallWidthMm(rack.widthMm, list)} mm. Presets only fill in starting values.`}</p>
      {(['left', 'right'] as const).map((side) => elementsOn(list, side).map((el, i, same) => (
        <details key={el.id} className="card" open={el.id === selectedId}
          onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && onSelect(el.id)}>
          <summary>{`${side === 'left' ? 'L' : 'R'}${i + 1} · ${el.name} · ${el.widthMm} mm${el.inside ? ' (inside)' : ''} · ${FACE_LABELS[el.faces]} · takes ${acceptsLabel(el)}`}</summary>
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
