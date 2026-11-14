import type { CatalogItem } from '../domain/catalog-item';
import type { ItemCollection } from '../domain/library/library';
import { slugify, uniqueId } from '../domain/ids';
import { useAppStore } from './store';
import type { ModuleTab } from './ui-slice';

type CatalogKey = 'devices' | 'racks' | 'optics' | 'cableMedia';

/**
 * Selection + CRUD for a catalog kind (built-in shadowed by project items).
 * Built-in items are read-only; editing goes through `duplicate`.
 * Deleting a built-in hides it in this project.
 */
export function useCatalogEditor<T extends CatalogItem>(key: CatalogKey, tab: ModuleTab, collection: ItemCollection<T>) {
  const selectedId = useAppStore((s) => s.selected[tab]);
  const select = useAppStore((s) => s.select);
  const upsert = useAppStore((s) => s.upsert);
  const remove = useAppStore((s) => s.remove);
  const hideBuiltin = useAppStore((s) => s.hideBuiltin);

  const selected = collection.get(selectedId);
  const readOnly = !!selectedId && collection.sourceOf(selectedId) === 'builtin';

  const save = (item: T) => upsert(key, item as never);
  /** Creates an item from `build(id)` with a unique id derived from `baseId`. */
  const create = (baseId: string, build: (id: string) => T) => {
    const item = build(uniqueId(slugify(baseId), collection.ids()));
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
    if (collection.sourceOf(id) === 'builtin') hideBuiltin(id);
    else remove(key, id);
    select(tab, undefined);
  };
  return { selected, selectedId, readOnly, select: (id: string | undefined) => select(tab, id), save, create, duplicate, del };
}
