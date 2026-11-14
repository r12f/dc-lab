import type { PropertyDef, PropertyValue } from '../../domain/properties/types';
import { coerce } from '../../domain/properties/properties';
import { Field } from '../../ui/fields';

interface Props {
  def: PropertyDef;
  value: PropertyValue | undefined;
  onChange(value: PropertyValue | undefined): void;
}

/** Input for one custom property value, by property type. Empty = use the default. */
export function PropertyValueField({ def, value, onChange }: Props) {
  const label = `${def.name}${def.unit ? ` (${def.unit})` : ''}${def.showInBom ? ' · BOM' : ''}`;
  const placeholder = def.defaultValue === undefined ? '' : `default: ${String(def.defaultValue)}`;
  if (def.type === 'boolean') {
    return (
      <Field label={label}>
        <select value={value === undefined ? '' : String(value)} onChange={(e) => onChange(coerce(def, e.target.value))}>
          <option value="">{placeholder || '—'}</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </Field>
    );
  }
  if (def.type === 'select') {
    return (
      <Field label={label}>
        <select value={value === undefined ? '' : String(value)} onChange={(e) => onChange(coerce(def, e.target.value))}>
          <option value="">{placeholder || '—'}</option>
          {(def.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </Field>
    );
  }
  return (
    <Field label={label}>
      <input type={def.type === 'number' ? 'number' : 'text'} value={value === undefined ? '' : String(value)}
        placeholder={placeholder} onChange={(e) => onChange(coerce(def, e.target.value))} />
    </Field>
  );
}
