import type { CatalogItem } from '../../domain/catalogItem';
import type { ItemCollection, Library } from '../../domain/library/Library';
import { slugify, uniqueId } from '../../domain/ids';
import { useAppStore } from '../../state/store';
import { fromKey, toKey, type CatalogRef, type OpticsCatalog } from './catalogRef';

const STORE_KEY = { optic: 'optics', cable: 'cableMedia' } as const;

/** Selection + CRUD across the optic and cable catalogs (built-ins read-only, Duplicate to edit). */
export function useOpticsCatalog(lib: Library) {
  const key = useAppStore((s) => s.selected.optics);
  const select = useAppStore((s) => s.select);
  const upsert = useAppStore((s) => s.upsert);
  const remove = useAppStore((s) => s.remove);
  const hideBuiltin = useAppStore((s) => s.hideBuiltin);

  const collection = (c: OpticsCatalog): ItemCollection<CatalogItem> =>
    (c === 'optic' ? lib.optics : lib.cableMedia) as unknown as ItemCollection<CatalogItem>;
  const ref = fromKey(key);
  const readOnly = !!ref && collection(ref.catalog).sourceOf(ref.id) === 'builtin';

  const choose = (r: CatalogRef | undefined) => select('optics', r && toKey(r));
  const save = (catalog: OpticsCatalog, item: CatalogItem) => upsert(STORE_KEY[catalog], item as never);
  const create = (catalog: OpticsCatalog, baseId: string, build: (id: string) => CatalogItem) => {
    const item = build(uniqueId(slugify(baseId), collection(catalog).ids()));
    save(catalog, item);
    choose({ catalog, id: item.id });
  };
  const duplicate = (r: CatalogRef) => {
    const src = collection(r.catalog).get(r.id);
    if (!src) return;
    const copy = { ...structuredClone(src), id: uniqueId(slugify(`${src.id}-copy`), collection(r.catalog).ids()), name: `${src.name} (copy)` };
    save(r.catalog, copy);
    choose({ catalog: r.catalog, id: copy.id });
  };
  const del = (r: CatalogRef) => {
    if (collection(r.catalog).sourceOf(r.id) === 'builtin') hideBuiltin(r.id);
    else remove(STORE_KEY[r.catalog], r.id);
    choose(undefined);
  };
  return { ref, readOnly, choose, save, create, duplicate, del, collection };
}
