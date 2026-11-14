import type { CatalogItem } from '../domain/catalogItem';
import type { ItemCollection } from '../domain/library/Library';
import { slugify, uniqueId } from '../domain/ids';
import { useAppStore } from './store';
import type { ModuleTab } from './uiSlice';

type CatalogKey = 'devices' | 'racks';

/**
 * Selection + CRUD for a catalog kind (built-in shadowed by project items).
 * Built-in items are read-only; editing goes through `duplicate`.
 */
export function useCatalogEditor<T extends CatalogItem>(
  key: CatalogKey,
  tab: ModuleTab,
  collection: ItemCollection<T>,
  factory: (id: string) => T,
) {
  const selectedId = useAppStore((s) => s.selected[tab]);
  const select = useAppStore((s) => s.select);
  const upsert = useAppStore((s) => s.upsert);
  const remove = useAppStore((s) => s.remove);

  const selected = collection.get(selectedId);
  const readOnly = !!selectedId && collection.sourceOf(selectedId) === 'builtin';

  const save = (item: T) => upsert(key, item as never);
  const create = () => {
    const item = factory(uniqueId('new-item', collection.ids()));
    save(item);
    select(tab, item.id);
  };
  const duplicate = (id: string) => {
    const src = collection.get(id);
    if (!src) return;
    const copy = { ...structuredClone(src), id: uniqueId(slugify(`${src.id}-copy`), collection.ids()), name: `${src.name} (copy)` };
    save(copy);
    select(tab, copy.id);
  };
  const del = (id: string) => {
    remove(key, id);
    select(tab, undefined);
  };
  return { selected, selectedId, readOnly, select: (id: string | undefined) => select(tab, id), save, create, duplicate, del };
}
