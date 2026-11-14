import type { ItemVariant } from '../../domain/items/types';
import type { Library } from '../../domain/library/library';
import { Button } from '../../ui/button';
import { Section, TextField } from '../../ui/fields';
import { CustomPropertiesSection } from '../properties/custom-properties-section';
import type { ItemVariantCommands } from './use-item-variants';

interface Props {
  lib: Library;
  variant: ItemVariant;
  itemTypeName: string;
  readOnly: boolean;
  commands: ItemVariantCommands;
}

/** Item (vendor product) editor: vendor, model / vendor PN, default flag, custom properties. */
export function ItemVariantEditor({ lib, variant: v, itemTypeName, readOnly, commands }: Props) {
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
      <CustomPropertiesSection target={v.target} item={v} builtin={readOnly} onChange={(properties) => set({ properties })} />
    </>
  );
}
