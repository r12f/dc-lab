/** Common identity of every library item (devices, racks, optics, cables). */
export interface CatalogItem {
  id: string;
  name: string;
}

export type ItemSource = 'builtin' | 'project';

export interface Sourced<T> {
  item: T;
  source: ItemSource;
}
