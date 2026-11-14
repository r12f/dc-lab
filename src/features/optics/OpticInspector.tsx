import type { OpticDefinition, OpticPackaging, Pigtail } from '../../domain/optics/types';
import { OPTIC_SCHEMA } from '../../domain/optics/types';
import { withPackaging, withPigtail } from '../../domain/optics/factory';
import { FORM_FACTORS } from '../../domain/ports/formFactors';
import { NumberField, Section, SelectField, TextField } from '../../ui/fields';
import { ReadOnlyNotice } from '../../ui/ReadOnlyNotice';
import { CustomPropertiesSection } from '../properties/CustomPropertiesSection';
import { ExportJsonButton } from './ExportJsonButton';

interface Props {
  optic: OpticDefinition;
  readOnly: boolean;
  onChange(o: OpticDefinition): void;
  onDuplicate(): void;
}

const packagingOptions: { value: OpticPackaging; label: string }[] = [
  { value: 'module', label: 'Pluggable module' }, { value: 'pigtail', label: 'Pigtail (fiber attached)' },
];
const fiberOptions: { value: Pigtail['fiberType']; label: string }[] = [
  { value: 'fiber-sm', label: 'Single-mode' }, { value: 'fiber-mm', label: 'Multimode' },
];
const formFactorOptions = (current: string) =>
  [...new Set([current, ...FORM_FACTORS.filter((f) => f.kind !== 'power' && f.kind !== 'copper').map((f) => f.id)])]
    .map((id) => ({ value: id, label: id }));

function PigtailSection({ p, onChange }: { p: Pigtail; onChange(p: Pigtail): void }) {
  const set = (patch: Partial<Pigtail>) => onChange({ ...p, ...patch });
  return (
    <Section title="Pigtail">
      <div className="row2">
        <NumberField label="Fiber legs" value={p.count} min={1} onChange={(count) => set({ count: Math.max(1, count) })} />
        <NumberField label="Leg length m" value={p.lengthM} min={0} step={0.1} onChange={(lengthM) => set({ lengthM })} />
      </div>
      <div className="row2">
        <TextField label="End connector" value={p.connector} onChange={(connector) => set({ connector })} />
        <SelectField<Pigtail['fiberType']> label="Fiber" value={p.fiberType} options={fiberOptions} onChange={(fiberType) => set({ fiberType })} />
      </div>
      <p className="muted">Patch cables must match the end connector; one cable per leg.</p>
    </Section>
  );
}

export function OpticInspector({ optic: o, readOnly, onChange, onDuplicate }: Props) {
  const set = (patch: Partial<OpticDefinition>) => onChange({ ...o, ...patch });
  const pigtail = o.packaging === 'pigtail';
  return (
    <div className="inspector-inner">
      {readOnly && <ReadOnlyNotice onDuplicate={onDuplicate} />}
      <fieldset disabled={readOnly} className="plain">
        <Section title="General">
          <TextField label="Id" value={o.id} onChange={() => undefined} disabled />
          <TextField label="Name" value={o.name} onChange={(name) => set({ name })} />
          <SelectField<OpticPackaging> label="Packaging" value={o.packaging} options={packagingOptions}
            onChange={(p) => onChange(withPackaging(o, p))} />
          <div className="row2">
            <TextField label="Vendor" value={o.vendor} onChange={(vendor) => set({ vendor })} />
            <TextField label="Model / Vendor PN" value={o.model ?? ''} onChange={(model) => set({ model: model || undefined })} />
          </div>
        </Section>
        <Section title="Interface">
          <div className="row2">
            <SelectField label="Form factor" value={o.formFactor} options={formFactorOptions(o.formFactor)} onChange={(formFactor) => set({ formFactor })} />
            <NumberField label="Speed Gbps" value={o.speedGbps} min={0} onChange={(speedGbps) => set({ speedGbps })} />
          </div>
          <div className="row2">
            <TextField label="Reach" value={o.reach} onChange={(reach) => set({ reach })} />
            <NumberField label="Max reach m" value={o.reachM} min={0} onChange={(reachM) => set({ reachM })} />
          </div>
          <TextField label={pigtail ? 'Fiber connector (from pigtail)' : 'Fiber connector'} value={o.fiberConnector}
            disabled={pigtail} onChange={(fiberConnector) => set({ fiberConnector })} />
        </Section>
        {pigtail && o.pigtail && <PigtailSection p={o.pigtail} onChange={(p) => onChange(withPigtail(o, p))} />}
        <Section title="Power & weight">
          <div className="row2">
            <NumberField label="Power W" value={o.powerW} min={0} step={0.1} onChange={(powerW) => set({ powerW })} />
            <NumberField label="Weight kg" value={o.weightKg ?? 0} min={0} step={0.01} onChange={(weightKg) => set({ weightKg: weightKg || undefined })} />
          </div>
        </Section>
      </fieldset>
      <CustomPropertiesSection target="optic" item={o} builtin={readOnly} onChange={(properties) => onChange({ ...o, properties })} />
      <ExportJsonButton schema={OPTIC_SCHEMA} item={o} label="Export optic JSON" />
    </div>
  );
}
