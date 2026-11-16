import type { Library } from '../library/library';
import type { ItemVariant } from '../items/types';
import type { RackDesign } from './types';

/** Pick key of in-rack cables of one cable type and length. */
export const cableLengthPickKey = (cableId: string, lengthM: number) => `${cableId}@${lengthM}`;

/** The item of an in-rack cable run: the one fixed on the run, else the BOM pick for its type and length. */
export function cableRunItem(lib: Library, design: RackDesign, c: { mediaId: string; itemId?: string }, lengthM: number): { item: ItemVariant | undefined; fixed: boolean } {
  const own = lib.variants.get(c.itemId);
  if (own && own.itemId === c.mediaId) return { item: own, fixed: true };
  return { item: bomItem(lib, design, c.mediaId, cableLengthPickKey(c.mediaId, lengthM)), fixed: false };
}

/**
 * The item (vendor product) a design's BOM uses for an item type: the pick under `pickKey` (if given), else the
 * pick for the item type, else its Generic item. Picks of another item type are ignored.
 */
export function bomItem(lib: Library, design: RackDesign, itemTypeId: string, pickKey?: string): ItemVariant | undefined {
  const picks = design.bomItems ?? {};
  for (const k of pickKey ? [pickKey, itemTypeId] : [itemTypeId]) {
    const v = lib.variants.get(picks[k]);
    if (v && v.itemId === itemTypeId) return v;
  }
  return lib.variants.defaultOf(itemTypeId);
}
