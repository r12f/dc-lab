import type { PropertyValue } from '../properties/types';
import type { ItemTarget, ItemVariant } from './types';
import { GENERIC_SUFFIX, genericVariantId } from './types';

export interface VariantSource {
  variant: ItemVariant;
  /** True for a library-generated generic item that the project has not saved. */
  synthesized: boolean;
}

/**
 * Items per item type: the generic item (synthesized unless the project saved one with that id),
 * then project items. The generic item is what a BOM line uses until it picks another.
 */
export class VariantIndex {
  private readonly byItem = new Map<string, VariantSource[]>();
  private readonly byId = new Map<string, VariantSource>();

  constructor(
    itemTypes: { target: ItemTarget; id: string; name: string }[],
    projectVariants: readonly ItemVariant[],
    hidden: ReadonlySet<string>,
    builtinProperties: Readonly<Record<string, Record<string, PropertyValue>>>,
  ) {
    const saved = new Map(projectVariants.map((v) => [v.id, v]));
    for (const t of itemTypes) {
      const gid = genericVariantId(t.id);
      const own = saved.get(gid);
      const list: VariantSource[] = [];
      if (own) list.push({ variant: own, synthesized: false });
      else if (!hidden.has(gid)) {
        // Older projects keyed values of built-in items by the item type id.
        const properties = { ...builtinProperties[t.id], ...builtinProperties[gid] };
        list.push({ variant: { id: gid, name: t.name, target: t.target, itemId: t.id, vendor: 'Generic', model: t.name, properties }, synthesized: true });
      }
      this.byItem.set(t.id, list);
    }
    for (const v of projectVariants) {
      if (v.id.endsWith(GENERIC_SUFFIX) && this.byItem.has(v.itemId) && v.id === genericVariantId(v.itemId)) continue;
      this.byItem.get(v.itemId)?.push({ variant: v, synthesized: false });
    }
    for (const list of this.byItem.values()) for (const s of list) this.byId.set(s.variant.id, s);
  }

  of(itemId: string): ItemVariant[] {
    return (this.byItem.get(itemId) ?? []).map((s) => s.variant);
  }

  get(id: string | undefined): ItemVariant | undefined {
    return id ? this.byId.get(id)?.variant : undefined;
  }

  isSynthesized(id: string): boolean {
    return !!this.byId.get(id)?.synthesized;
  }

  defaultOf(itemId: string): ItemVariant | undefined {
    const list = this.of(itemId);
    return list.find((v) => v.id === genericVariantId(itemId)) ?? list[0];
  }

  /** The chosen item if it belongs to the item type, else its default. */
  resolve(itemId: string, variantId?: string): ItemVariant | undefined {
    const v = this.get(variantId);
    return v && v.itemId === itemId ? v : this.defaultOf(itemId);
  }

  ids(): string[] {
    return [...this.byId.keys()];
  }
}

/** The device as this item: the item's power / weight where set, the item type's otherwise. */
export function withItemSpecs<T extends { power: { typicalW: number; maxW: number }; weightKg: number }>(device: T, item: ItemVariant | undefined): T {
  const s = item?.specs;
  if (!s) return device;
  return {
    ...device,
    power: { ...device.power, typicalW: s.typicalW ?? device.power.typicalW, maxW: s.maxW ?? device.power.maxW },
    weightKg: s.weightKg ?? device.weightKg,
  };
}

/** Power of one optic module: the item's override when set, else the item type's. */
export function opticPowerW(item: ItemVariant | undefined, o: { powerW: number }): number {
  return item?.specs?.typicalW ?? o.powerW;
}

/** Power per active end of a cable (AEC / AOC): the item's override when set, else the item type's. */
export function cablePowerWPerEnd(item: ItemVariant | undefined, c: { powerWPerEnd?: number } | undefined): number {
  if (!c) return 0;
  return item?.specs?.typicalW ?? c.powerWPerEnd ?? 0;
}

/** "Acme SW-6400", or just the model when the vendor is generic. */
export function variantLabel(v: ItemVariant | undefined): string {
  if (!v) return '';
  return [v.vendor, v.model].filter(Boolean).join(' ');
}
