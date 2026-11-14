import { isMultiFiber } from '../../domain/optics/connectors';
import type { ReactNode } from 'react';
import type { OpticDefinition, OpticPackaging, Pigtail } from '../../domain/optics/types';
import { OPTIC_SCHEMA } from '../../domain/optics/types';
import { withPackaging, withPigtail } from '../../domain/optics/factory';
import { FORM_FACTORS } from '../../domain/ports/form-factors';
import { NumberField, Section, SelectField, TextField } from '../../ui/fields';
import { ReadOnlyNotice } from '../../ui/read-only-notice';
import { ExportJsonButton } from './export-json-button';
import { connectorForReach, directAttachType } from '../../domain/ports/optic-match';
import { connectorsMate } from '../../domain/optics/connectors';

/** Lane multiplier of a reach ("2xDR4" -> "2x "). */
const legPrefix = (reach: string) => /^(\d+)x/i.exec(reach.trim())?.[1];

/** Typing a reach sets the connector it implies (2xDR4 -> "2x MPO-12", FR4 -> "LC"); unknown reaches keep it. */
function reachConnector(o: OpticDefinition, reach: string): Partial<OpticDefinition> {
  if (o.packaging === 'pigtail') return {};
  const c = connectorForReach(reach);
  if (!c) return {};
  const n = legPrefix(reach);
  return { fiberConnector: n ? `${n}x ${c}` : c };
}

/** Connector that contradicts the reach (e.g. DR4 on LC). */
function connectorMismatch(o: OpticDefinition): string | undefined {
  const want = connectorForReach(o.reach);
  const have = o.fiberConnector?.replace(/^\d+x\s*/i, '');
  if (!want || !have || connectorsMate(want, have)) return undefined;
  return `${o.reach} uses ${want === 'MPO-12' ? 'MPO-8/12' : want}, not ${have}.`;
}

interface Props {
  optic: OpticDefinition;
  readOnly: boolean;
  onChange(o: OpticDefinition): void;
  onDuplicate(): void;
  /** Item editor or item list, shown above the item type editor. */
  header?: ReactNode;
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
      {isMultiFiber(p.connector) && (
        <SelectField<'' | 'male' | 'female'> label="End connector gender" value={p.gender ?? ''}
          options={[{ value: '', label: '—' }, { value: 'male', label: 'Male (pinned)' }, { value: 'female', label: 'Female (unpinned)' }]}
          onChange={(g) => set({ gender: g || undefined })} />
      )}
      <p className="muted">Patch cables must match the end connector; one cable per leg.</p>
    </Section>
  );
}

export function OpticInspector({ optic: o, header, readOnly, onChange, onDuplicate }: Props) {
  const set = (patch: Partial<OpticDefinition>) => onChange({ ...o, ...patch });
  const pigtail = o.packaging === 'pigtail';
  return (
    <div className="inspector-inner">
      {header}
      <h3 className="inspector-subtitle">Item type</h3>
      {readOnly && <ReadOnlyNotice onDuplicate={onDuplicate} />}
      <fieldset disabled={readOnly} className="plain">
        <Section title="General">
          <TextField label="Id" value={o.id} onChange={() => undefined} disabled />
          <TextField label="Name" value={o.name} onChange={(name) => set({ name })} />
          <SelectField<OpticPackaging> label="Packaging" value={o.packaging} options={packagingOptions}
            onChange={(p) => onChange(withPackaging(o, p))} />
        </Section>
        <Section title="Interface">
          <div className="row2">
            <SelectField label="Form factor" value={o.formFactor} options={formFactorOptions(o.formFactor)} onChange={(formFactor) => set({ formFactor })} />
            <NumberField label="Speed Gbps" value={o.speedGbps} min={0} onChange={(speedGbps) => set({ speedGbps })} />
          </div>
          <div className="row2">
            <TextField label="Reach" value={o.reach} onChange={(reach) => set({ reach, ...reachConnector(o, reach) })} />
            {directAttachType(o.reach) && <p className="error">DAC / AEC / AOC are cables, not optics — create a Cable instead.</p>}
            <NumberField label="Max reach m" value={o.reachM} min={0} onChange={(reachM) => set({ reachM })} />
          </div>
          <TextField label={pigtail ? 'Fiber connector (from pigtail)' : 'Fiber connector'} value={o.fiberConnector}
            disabled={pigtail} onChange={(fiberConnector) => set({ fiberConnector })} />
          {!pigtail && connectorMismatch(o) && <p className="error">{connectorMismatch(o)}</p>}
        </Section>
        {pigtail && o.pigtail && <PigtailSection p={o.pigtail} onChange={(p) => onChange(withPigtail(o, p))} />}
        <Section title="Power & weight">
          <div className="row2">
            <NumberField label="Power W" value={o.powerW} min={0} step={0.1} onChange={(powerW) => set({ powerW })} />
            <NumberField label="Weight kg" value={o.weightKg ?? 0} min={0} step={0.01} onChange={(weightKg) => set({ weightKg: weightKg || undefined })} />
          </div>
        </Section>
      </fieldset>
      <ExportJsonButton schema={OPTIC_SCHEMA} item={o} label="Export optic JSON" />
    </div>
  );
}
