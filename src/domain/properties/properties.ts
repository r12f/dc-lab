import type { HasProperties, PropertyDef, PropertyTarget, PropertyValue } from './types';

export function defsFor(defs: readonly PropertyDef[], target: PropertyTarget): PropertyDef[] {
  return defs.filter((d) => d.appliesTo.includes(target));
}

/** Value of a property on an item, falling back to the definition default. */
export function valueOf(item: HasProperties | undefined, def: PropertyDef): PropertyValue | undefined {
  const v = item?.properties?.[def.id];
  return v === undefined || v === '' ? def.defaultValue : v;
}

/** Display text of a value: yes/no for booleans, unit suffix for numbers. */
export function formatValue(def: PropertyDef, v: PropertyValue | undefined): string {
  if (v === undefined || v === '') return '';
  if (def.type === 'boolean') return v ? 'Yes' : 'No';
  if (def.type === 'number' && def.unit) return `${v} ${def.unit}`;
  return String(v);
}

/** Coerces raw input to the property type ('' clears the value). */
export function coerce(def: PropertyDef, raw: string | boolean): PropertyValue | undefined {
  if (raw === '') return undefined;
  if (def.type === 'boolean') return raw === true || raw === 'true';
  if (def.type === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  return String(raw);
}

/** `properties` with `id` set to `value` (removed when undefined). */
export function withValue(
  properties: Record<string, PropertyValue> | undefined, id: string, value: PropertyValue | undefined,
): Record<string, PropertyValue> {
  const next = { ...properties };
  if (value === undefined) delete next[id];
  else next[id] = value;
  return next;
}

export function newPropertyDef(id: string, name: string, appliesTo: PropertyTarget[]): PropertyDef {
  return { id, name, appliesTo, type: 'text', showInBom: false };
}
