import type { CableEnd, ConnectorGender } from '../../domain/optics/types';
import { isMultiFiber } from '../../domain/optics/connectors';
import { NumberField, Section, SelectField, TextField } from '../../ui/fields';

const genders: { value: '' | ConnectorGender; label: string }[] = [
  { value: '', label: '—' }, { value: 'male', label: 'Male (pinned)' }, { value: 'female', label: 'Female (unpinned)' },
];

/** Count, connector, fibers per connector and gender of one cable end. */
export function CableEndFields({ title, end, fiber, onChange }: { title: string; end: CableEnd; fiber: boolean; onChange(e: CableEnd): void }) {
  const set = (patch: Partial<CableEnd>) => onChange({ ...end, ...patch });
  return (
    <Section title={title}>
      <div className="row2">
        <NumberField label="Connectors" value={end.count} min={1} onChange={(count) => set({ count: Math.max(1, count) })} />
        <TextField label="Connector" value={end.connector} onChange={(connector) => set({ connector })} />
      </div>
      {fiber && (
        <div className="row2">
          <NumberField label="Fibers used / connector" value={end.fibers ?? 0} min={0} onChange={(fibers) => set({ fibers: fibers || undefined })} />
          {isMultiFiber(end.connector) && (
            <SelectField<'' | ConnectorGender> label="Gender" value={end.gender ?? ''} options={genders}
              onChange={(g) => set({ gender: g || undefined })} />
          )}
        </div>
      )}
    </Section>
  );
}
