import type { CableBreakout, CableMedia, CableType } from '../../domain/optics/types';
import { CABLE_SCHEMA } from '../../domain/optics/types';
import { CABLE_TYPES, isFiber } from '../../domain/optics/cable-types';
import { Field, NumberField, Section, SelectField, TextField } from '../../ui/fields';
import { ReadOnlyNotice } from '../../ui/read-only-notice';
import { CustomPropertiesSection } from '../properties/custom-properties-section';
import { ExportJsonButton } from './export-json-button';

interface Props {
  cable: CableMedia;
  readOnly: boolean;
  onChange(c: CableMedia): void;
  onDuplicate(): void;
}

const typeOptions = (Object.keys(CABLE_TYPES) as CableType[]).map((t) => ({ value: t, label: CABLE_TYPES[t] }));

export function CableInspector({ cable: c, readOnly, onChange, onDuplicate }: Props) {
  const set = (patch: Partial<CableMedia>) => onChange({ ...c, ...patch });
  return (
    <div className="inspector-inner">
      {readOnly && <ReadOnlyNotice onDuplicate={onDuplicate} />}
      <fieldset disabled={readOnly} className="plain">
        <Section title="General">
          <TextField label="Id" value={c.id} onChange={() => undefined} disabled />
          <TextField label="Name" value={c.name} onChange={(name) => set({ name })} />
          <div className="row2">
            <TextField label="Vendor" value={c.vendor ?? ''} onChange={(vendor) => set({ vendor: vendor || undefined })} />
            <TextField label="Model / Vendor PN" value={c.model ?? ''} onChange={(model) => set({ model: model || undefined })} />
          </div>
        </Section>
        <Section title="Media">
          <div className="row2">
            <SelectField<CableType> label="Type" value={c.type} options={typeOptions} onChange={(type) => set({ type })} />
            <TextField label="Connector" value={c.connector} onChange={(connector) => set({ connector })} />
          </div>
          <div className="row3">
            {isFiber(c.type) && (
              <NumberField label="Fibers" value={c.fiberCount ?? 0} min={0} onChange={(fiberCount) => set({ fiberCount: fiberCount || undefined })} />
            )}
            <NumberField label="Max length m" value={c.maxLengthM ?? 0} min={0} onChange={(maxLengthM) => set({ maxLengthM: maxLengthM || undefined })} />
            <Field label="Color"><input type="color" value={c.color} onChange={(e) => set({ color: e.target.value })} /></Field>
          </div>
        </Section>
        <Section title="Breakout">
          <SelectField label="Ends" value={c.breakout ? 'breakout' : 'straight'}
            options={[{ value: 'straight', label: 'Straight (same connector both ends)' }, { value: 'breakout', label: 'Breakout (B end fans out)' }]}
            onChange={(v) => set({ breakout: v === 'breakout' ? { count: 4, connector: 'LC' } : undefined })} />
          {c.breakout && (
            <div className="row2">
              <NumberField label="B legs" value={c.breakout.count} min={2}
                onChange={(count) => set({ breakout: { ...(c.breakout as CableBreakout), count: Math.max(2, count) } })} />
              <TextField label="B leg connector" value={c.breakout.connector}
                onChange={(connector) => set({ breakout: { ...(c.breakout as CableBreakout), connector } })} />
            </div>
          )}
        </Section>
      </fieldset>
      <CustomPropertiesSection target="cable" item={c} builtin={readOnly} onChange={(properties) => onChange({ ...c, properties })} />
      <ExportJsonButton schema={CABLE_SCHEMA} item={c} label="Export cable JSON" />
    </div>
  );
}
