export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange(v: T): void }) {
  return (
    <div className="subtabs">
      {tabs.map((t) => (
        <button key={t.id} type="button" className={t.id === value ? 'active' : ''} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
