import type { Library } from '../../domain/library/library';
import type { ItemTarget, ItemVariant } from '../../domain/items/types';
import { genericVariantId } from '../../domain/items/types';
import { slugify, uniqueId } from '../../domain/ids';
import { useAppStore } from '../../state/store';

/** Commands on items (vendor products) of item types. */
export function useItemVariants(lib: Library) {
  const upsert = useAppStore((s) => s.upsert);
  const remove = useAppStore((s) => s.remove);
  const hideBuiltin = useAppStore((s) => s.hideBuiltin);
  const variants = useAppStore((s) => s.project.variants);

  const save = (v: ItemVariant) => upsert('variants', { ...v, name: [v.vendor, v.model].filter(Boolean).join(' ') || v.id });

  /** Synthesized generic items of built-in item types are fixed (only their property values are editable). */
  const isReadOnly = (v: ItemVariant, itemTypeBuiltin: boolean) => itemTypeBuiltin && lib.variants.isSynthesized(v.id);

  const add = (target: ItemTarget, itemId: string): string => {
    const id = uniqueId(slugify(`${itemId}-item`), lib.variants.ids());
    save({ id, name: id, target, itemId, vendor: '', model: '', properties: {} });
    return id;
  };
  const duplicate = (v: ItemVariant): string => {
    const id = uniqueId(slugify(`${v.itemId}-item`), lib.variants.ids());
    save({ ...structuredClone(v), id, isDefault: undefined, model: v.model ? `${v.model} (copy)` : '' });
    return id;
  };
  const del = (v: ItemVariant) => {
    if (variants.some((x) => x.id === v.id)) remove('variants', v.id);
    // A deleted generic item stays deleted (it would otherwise be synthesized again).
    if (v.id === genericVariantId(v.itemId)) hideBuiltin(v.id);
  };
  /** Marks `v` as its item type's default; saved siblings lose the mark. */
  const makeDefault = (v: ItemVariant) => {
    for (const x of lib.variants.of(v.itemId)) {
      if (x.id !== v.id && x.isDefault) save({ ...x, isDefault: undefined });
    }
    save({ ...v, isDefault: true });
  };
  return { save, add, duplicate, del, makeDefault, isReadOnly };
}

export type ItemVariantCommands = ReturnType<typeof useItemVariants>;
