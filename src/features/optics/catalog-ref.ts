/**
 * The Optics & Cables module lists two catalogs in one tree. Sidebar ids are prefixed with the
 * catalog so an optic and a cable may share an id.
 */
export type OpticsCatalog = 'optic' | 'cable';

export interface CatalogRef {
  catalog: OpticsCatalog;
  id: string;
}

export const toKey = (r: CatalogRef): string => `${r.catalog}:${r.id}`;

export function fromKey(key: string | undefined): CatalogRef | undefined {
  const m = /^(optic|cable):(.+)$/.exec(key ?? '');
  return m ? { catalog: m[1] as OpticsCatalog, id: m[2] } : undefined;
}
