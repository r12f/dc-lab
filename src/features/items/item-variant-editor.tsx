import type { ItemSpecs, ItemVariant } from '../../domain/items/types';
import type { Library } from '../../domain/library/library';
import { Button } from '../../ui/button';
import { Field, Section, TextField } from '../../ui/fields';
import { CustomPropertiesSection } from '../properties/custom-properties-section';
import type { ItemVariantCommands } from './use-item-variants';
import { variantLabel } from '../../domain/items/variants';

interface Props {
  lib: Library;
  variant: ItemVariant;
  itemTypeName: string;
  readOnly: boolean;
  commands: ItemVariantCommands;
  /** After the item is deleted (e.g. go back to the item type). */
  onDeleted?(): void;
}

/** Override field: empty = inherit the item type's value (shown as the placeholder). */
function OverrideField({ label, value, inherited, onChange }: { label: string; value?: number; inherited: number; onChange(v: number | undefined): void }) {
  return (
    <Field label={label}>
      <input type="number" min={0} value={value ?? ''} placeholder={`${inherited} (item type)`}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
    </Field>
  );
}

/** Power and weight of a device item; empty fields inherit the item type. */
function DeviceSpecs({ lib, v, set, disabled }: { lib: Library; v: ItemVariant; set(p: Partial<ItemVariant>): void; disabled: boolean }) {
  const d = lib.devices.get(v.itemId);
  if (!d) return null;
  const s = v.specs ?? {};
  const put = (k: keyof ItemSpecs, x: number | undefined) => {
    const next: ItemSpecs = { ...s, [k]: x };
    if (x === undefined) delete next[k];
    set({ specs: Object.keys(next).length ? next : undefined });
  };
  return (
    <Section title="Power & weight">
      <p className="muted">Empty = item type value. Set a value to override it for this product.</p>
      <fieldset disabled={disabled} className="plain">
        <div className="row3">
          <OverrideField label="Typical W" value={s.typicalW} inherited={d.power.typicalW} onChange={(x) => put('typicalW', x)} />
          <OverrideField label="Max W" value={s.maxW} inherited={d.power.maxW} onChange={(x) => put('maxW', x)} />
          <OverrideField label="Weight kg" value={s.weightKg} inherited={d.weightKg} onChange={(x) => put('weightKg', x)} />
        </div>
      </fieldset>
    </Section>
  );
}

/** Optic / cable item: its own power (module W, or W per active cable end); empty = the item type's. */
function PowerSpec({ lib, v, set, disabled }: { lib: Library; v: ItemVariant; set(p: Partial<ItemVariant>): void; disabled: boolean }) {
  const inherited = v.target === 'optic' ? lib.optics.get(v.itemId)?.powerW : lib.cableMedia.get(v.itemId)?.powerWPerEnd;
  return (
    <Section title="Power">
      <p className="muted">Empty = item type value. Applies where this is the item type's default item.</p>
      <fieldset disabled={disabled} className="plain">
        <OverrideField label={v.target === 'optic' ? 'Power W' : 'Power per end W'} value={v.specs?.typicalW} inherited={inherited ?? 0}
          onChange={(x) => set({ specs: x === undefined ? undefined : { typicalW: x } })} />
      </fieldset>
    </Section>
  );
}

/** Item (vendor product) editor: vendor, model / vendor PN, default flag, custom properties. */
export function ItemVariantEditor({ lib, variant: v, itemTypeName, readOnly, commands, onDeleted }: Props) {
  const isDefault = lib.variants.defaultOf(v.itemId)?.id === v.id;
  const set = (patch: Partial<ItemVariant>) => commands.save({ ...v, ...patch });
  return (
    <>
      <Section title="Item">
        <p className="muted">{`Item of ${itemTypeName}${isDefault ? ' · default' : ''}`}</p>
        {readOnly && <p className="muted">Generic item of a built-in item type: vendor and model are fixed. Add your own item with “+ Item”.</p>}
        <fieldset disabled={readOnly} className="plain">
          <div className="row2">
            <TextField label="Vendor" value={v.vendor} onChange={(vendor) => set({ vendor })} />
            <TextField label="Model / Vendor PN" value={v.model} onChange={(model) => set({ model })} />
          </div>
        </fieldset>
        {!isDefault && <Button onClick={() => commands.makeDefault(v)}>Make default</Button>}
      </Section>
      {v.target === 'device' && <DeviceSpecs lib={lib} v={v} set={set} disabled={readOnly} />}
      {v.target !== 'device' && <PowerSpec lib={lib} v={v} set={set} disabled={readOnly} />}
      <CustomPropertiesSection target={v.target} item={v} builtin={readOnly} onChange={(properties) => set({ properties })} />
      {commands.canDelete(v) && <Button variant="danger" onClick={() => {
        if (!confirm(`Delete item "${variantLabel(v) || v.id}"?`)) return;
        commands.del(v);
        onDeleted?.();
      }}>✕ Delete item</Button>}
    </>
  );
}
