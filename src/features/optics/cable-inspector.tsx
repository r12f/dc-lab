import type { ReactNode } from 'react';
import type { CableMedia, CableType, FiberMapping, Polarity } from '../../domain/optics/types';
import { CABLE_SCHEMA } from '../../domain/optics/types';
import { CABLE_TYPES, isFiber } from '../../domain/optics/cable-types';
import { Field, NumberField, Section, SelectField, TextField } from '../../ui/fields';
import { ReadOnlyNotice } from '../../ui/read-only-notice';
import { ExportJsonButton } from './export-json-button';
import { CableEndFields } from './cable-end-fields';
import { cableSummary, fiberMap } from '../../domain/optics/fiber-map';
import { isMultiFiber } from '../../domain/optics/connectors';

interface Props {
  cable: CableMedia;
  readOnly: boolean;
  onChange(c: CableMedia): void;
  onDuplicate(): void;
  /** Item editor or item list, shown above the item type editor. */
  header?: ReactNode;
}

const typeOptions = (Object.keys(CABLE_TYPES) as CableType[]).map((t) => ({ value: t, label: CABLE_TYPES[t] }));
const mappingOptions: { value: FiberMapping; label: string }[] = [
  { value: 'straight', label: 'Straight (in order)' }, { value: 'shuffle', label: 'Shuffle (each A to every B)' },
];
const polarityOptions: { value: '' | Polarity; label: string }[] = [
  { value: '', label: '—' }, { value: 'A', label: 'Type A (key-up/key-down)' }, { value: 'B', label: 'Type B (key-up/key-up)' }, { value: 'C', label: 'Type C (pair flip)' },
];

export function CableInspector({ cable: c, header, readOnly, onChange, onDuplicate }: Props) {
  const set = (patch: Partial<CableMedia>) => onChange({ ...c, ...patch });
  const fiber = isFiber(c.type);
  const fm = fiberMap(c);
  const multi = isMultiFiber(c.ends.a.connector) || isMultiFiber(c.ends.b.connector);
  return (
    <div className="inspector-inner">
      {header}
      <h3 className="inspector-subtitle">Item type</h3>
      {readOnly && <ReadOnlyNotice onDuplicate={onDuplicate} />}
      <fieldset disabled={readOnly} className="plain">
        <Section title="General">
          <TextField label="Id" value={c.id} onChange={() => undefined} disabled />
          <TextField label="Name" value={c.name} onChange={(name) => set({ name })} />
        </Section>
        <Section title="Media">
          <div className="row3">
            <SelectField<CableType> label="Type" value={c.type} options={typeOptions} onChange={(type) => set({ type })} />
            {fiber && <NumberField label="Cable fibers" value={c.fiberCount ?? 0} min={0} onChange={(fiberCount) => set({ fiberCount: fiberCount || undefined })} />}
            <Field label="Color"><input type="color" value={c.color} onChange={(e) => set({ color: e.target.value })} /></Field>
          </div>
          <NumberField label="Max length m" value={c.maxLengthM ?? 0} min={0} onChange={(maxLengthM) => set({ maxLengthM: maxLengthM || undefined })} />
        </Section>
        <CableEndFields title="A end" end={c.ends.a} fiber={fiber} onChange={(a) => set({ ends: { ...c.ends, a } })} />
        <CableEndFields title="B end" end={c.ends.b} fiber={fiber} onChange={(b) => set({ ends: { ...c.ends, b } })} />
        <Section title="Mapping">
          <div className="row2">
            <SelectField<FiberMapping> label="Fiber mapping" value={c.mapping} options={mappingOptions} onChange={(mapping) => set({ mapping })} />
            {multi && (
              <SelectField<'' | Polarity> label="Polarity" value={c.polarity ?? ''} options={polarityOptions}
                onChange={(p) => set({ polarity: p || undefined })} />
            )}
          </div>
          <p className="muted">{`${cableSummary(c)} · ${fm.links.length}F connected`
            + `${fm.unusedA ? ` · ${fm.unusedA}F unused on A` : ''}${fm.unusedB ? ` · ${fm.unusedB}F unused on B` : ''}`}</p>
        </Section>
      </fieldset>
      <ExportJsonButton schema={CABLE_SCHEMA} item={c} label="Export cable JSON" />
    </div>
  );
}
