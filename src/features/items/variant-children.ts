import type { Library } from '../../domain/library/library';
import type { SidebarItem } from '../../ui/sidebar';
import { variantLabel } from '../../domain/items/variants';
import { toItemKey } from './item-key';

/** Sidebar children of an item type: its items, default first, with vendor / model as the name. */
export function variantChildren(lib: Library, itemId: string, path: string[]): SidebarItem[] {
  const def = lib.variants.defaultOf(itemId);
  return lib.variants.of(itemId)
    .map((v) => ({
      id: toItemKey(v.id), name: variantLabel(v) || v.id, path,
      badge: v.id === def?.id ? 'default' : undefined,
      keywords: `${v.vendor} ${v.model}`,
    }))
    .sort((a, b) => Number(!a.badge) - Number(!b.badge) || a.name.localeCompare(b.name));
}

/** Text the sidebar filter matches for an item type's items. */
export function variantKeywords(lib: Library, itemId: string): string {
  return lib.variants.of(itemId).map((v) => `${v.vendor} ${v.model}`).join(' ');
}
