import type { CatalogItem } from '../catalog-item';
import type { HasProperties } from '../properties/types';

export const ITEM_SCHEMA = 'dc-lab/item@1';

/** Catalog kinds that have purchasable items (vendor products) under an item type. */
export type ItemTarget = 'device' | 'rack' | 'optic' | 'cable';

/** A concrete product of an item type: vendor, model / vendor PN and custom property values. */
export interface ItemVariant extends CatalogItem, HasProperties {
  schema?: typeof ITEM_SCHEMA;
  target: ItemTarget;
  /** Id of the item type (device, optic or cable definition). */
  itemId: string;
  vendor: string;
  /** Model / vendor PN. */
  model: string;
  /**
   * This product's own power / weight; unset fields inherit the item type's values. Devices: typical / max W and
   * weight. Optics: `typicalW` = module power. Cables: `typicalW` = power per active end (AEC / AOC).
   */
  specs?: ItemSpecs;
}

export interface ItemSpecs {
  typicalW?: number;
  maxW?: number;
  weightKg?: number;
}

export const GENERIC_SUFFIX = '--generic';

export const genericVariantId = (itemId: string) => `${itemId}${GENERIC_SUFFIX}`;
