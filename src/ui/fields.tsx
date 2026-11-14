import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  children: ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
}

export function TextField({ label, value, onChange, disabled }: TextFieldProps) {
  return (
    <Field label={label}>
      <input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange(value: number): void;
  min?: number;
  step?: number;
  disabled?: boolean;
}

export function NumberField({ label, value, onChange, min, step, disabled }: NumberFieldProps) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange(value: T): void;
  disabled?: boolean;
}

export function SelectField<T extends string>({ label, value, options, onChange, disabled }: SelectFieldProps<T>) {
  return (
    <Field label={label}>
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="section">
      <header className="section-head">
        <h3>{title}</h3>
        {actions}
      </header>
      {children}
    </section>
  );
}
