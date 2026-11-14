import { useState } from 'react';
import type { HasProperties, PropertyTarget, PropertyValue } from '../../domain/properties/types';
import { defsFor, newPropertyDef } from '../../domain/properties/properties';
import { slugify, uniqueId } from '../../domain/ids';
import { useAppStore } from '../../state/store';
import { Button } from '../../ui/Button';
import { Section } from '../../ui/fields';
import { PropertyDefEditor } from './PropertyDefEditor';
import { PropertyValueField } from './PropertyValueField';

interface Props {
  target: PropertyTarget;
  item: HasProperties & { id: string };
  /** Built-in items store values in the project instead of on the item. */
  builtin: boolean;
  /** Saves values on a project item. */
  onChange(properties: Record<string, PropertyValue>): void;
}

/**
 * Values of every project-wide property for this device/rack, plus an inline manager for the
 * definitions (add, edit, delete). Definitions are global: they apply to all items of the target kind.
 */
export function CustomPropertiesSection({ target, item, builtin, onChange }: Props) {
  const defs = useAppStore((s) => s.project.propertyDefs);
  const upsertDef = useAppStore((s) => s.upsertPropertyDef);
  const removeDef = useAppStore((s) => s.removePropertyDef);
  const setBuiltin = useAppStore((s) => s.setBuiltinProperty);
  const [managing, setManaging] = useState(false);
  const mine = defsFor(defs, target);

  const setValue = (id: string, v: PropertyValue | undefined) => {
    if (builtin) return setBuiltin(item.id, id, v);
    const next = { ...item.properties };
    if (v === undefined) delete next[id];
    else next[id] = v;
    onChange(next);
  };
  const add = () => {
    const name = `Property ${defs.length + 1}`;
    upsertDef(newPropertyDef(uniqueId(slugify(name), defs.map((d) => d.id)), name, [target]));
    setManaging(true);
  };

  return (
    <Section title="Custom properties" actions={
      <div className="row2">
        <Button onClick={add}>+ Property</Button>
        <Button onClick={() => setManaging((m) => !m)}>{managing ? 'Done' : 'Manage'}</Button>
      </div>
    }>
      {mine.length === 0 && !managing && <p className="muted">No custom properties. Properties apply to every {target}.</p>}
      {!managing && mine.map((d) => (
        <PropertyValueField key={d.id} def={d} value={item.properties?.[d.id]} onChange={(v) => setValue(d.id, v)} />
      ))}
      {managing && (
        <div className="card">
          <p className="muted">Definitions are project-wide: they apply to every item of the kinds they target.</p>
          {defs.map((d) => (
            <PropertyDefEditor key={d.id} def={d} onChange={upsertDef} onRemove={() => removeDef(d.id)} />
          ))}
        </div>
      )}
    </Section>
  );
}
