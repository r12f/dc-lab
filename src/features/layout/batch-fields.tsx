import { Field } from '../../ui/fields';

/** Value shared by all items, or undefined when they differ ("mixed"). */
export function common<T, K extends keyof T>(items: T[], key: K): T[K] | undefined {
  const v = items[0]?.[key];
  return items.every((i) => i[key] === v) ? v : undefined;
}

/** Number input over several items; empty shows "mixed" and leaves values untouched until edited. */
export function BatchNumber({ label, value, min, onChange }: { label: string; value: number | undefined; min?: number; onChange(v: number): void }) {
  return (
    <Field label={label}>
      <input type="number" min={min} value={value ?? ''} placeholder="mixed"
        onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))} />
    </Field>
  );
}

/** Select over several items; shows "mixed" when they differ. */
export function BatchSelect<T extends string>({ label, value, options, onChange }: {
  label: string; value: T | undefined; options: { value: T; label: string }[]; onChange(v: T): void;
}) {
  return (
    <Field label={label}>
      <select value={value ?? ''} onChange={(e) => e.target.value && onChange(e.target.value as T)}>
        {value === undefined && <option value="">mixed</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

export function BatchText({ label, value, onChange }: { label: string; value: string | undefined; onChange(v: string): void }) {
  return (
    <Field label={label}>
      <input value={value ?? ''} placeholder="mixed" onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}
