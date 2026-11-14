import { PROPERTY_TARGETS, type PropertyDef, type PropertyTarget, type PropertyType } from '../../domain/properties/types';
import { coerce } from '../../domain/properties/properties';
import { Button } from '../../ui/Button';
import { SelectField, TextField } from '../../ui/fields';

interface Props {
  def: PropertyDef;
  onChange(def: PropertyDef): void;
  onRemove(): void;
}

const typeOptions: { value: PropertyType; label: string }[] = [
  { value: 'text', label: 'Text' }, { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes / No' }, { value: 'select', label: 'Choice list' },
];

function toggle(list: PropertyTarget[], t: PropertyTarget, on: boolean): PropertyTarget[] {
  return on ? [...new Set([...list, t])] : list.filter((x) => x !== t);
}

/** Editor for one project-wide property definition. */
export function PropertyDefEditor({ def, onChange, onRemove }: Props) {
  const set = (patch: Partial<PropertyDef>) => onChange({ ...def, ...patch });
  return (
    <div className="subcard">
      <div className="row2">
        <TextField label="Name" value={def.name} onChange={(name) => set({ name })} />
        <SelectField<PropertyType> label="Type" value={def.type} options={typeOptions} onChange={(type) => set({ type, defaultValue: undefined })} />
      </div>
      {def.type === 'select' && (
        <TextField label="Choices (comma separated)" value={(def.options ?? []).join(', ')}
          onChange={(v) => set({ options: v.split(',').map((s) => s.trim()).filter(Boolean) })} />
      )}
      <div className="row2">
        {def.type === 'number' && <TextField label="Unit" value={def.unit ?? ''} onChange={(unit) => set({ unit: unit || undefined })} />}
        <TextField label="Default" value={def.defaultValue === undefined ? '' : String(def.defaultValue)}
          onChange={(v) => set({ defaultValue: coerce(def, v) })} />
      </div>
      <div className="checks">
        {PROPERTY_TARGETS.map((t) => (
          <label key={t.id}>
            <input type="checkbox" checked={def.appliesTo.includes(t.id)}
              onChange={(e) => set({ appliesTo: toggle(def.appliesTo, t.id, e.target.checked) })} />
            {t.label}
          </label>
        ))}
        <label>
          <input type="checkbox" checked={def.showInBom} onChange={(e) => set({ showInBom: e.target.checked })} />
          Show in BOM
        </label>
      </div>
      <Button variant="danger" onClick={() => confirm(`Delete property "${def.name}" from every item?`) && onRemove()}>Delete property</Button>
    </div>
  );
}
