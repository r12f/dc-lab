import type { CatalogItem, ItemSource, Sourced } from '../catalogItem';
import type { DeviceDefinition } from '../device/types';
import type { RackTemplate } from '../rack/types';
import type { CableMedia, OpticDefinition } from '../optics/types';

/** One collection of a kind: built-in items shadowed by project items with the same id. */
export class ItemCollection<T extends CatalogItem> {
  private readonly byId = new Map<string, Sourced<T>>();

  constructor(builtin: readonly T[], project: readonly T[], hidden: ReadonlySet<string> = new Set()) {
    for (const item of builtin) if (!hidden.has(item.id)) this.byId.set(item.id, { item, source: 'builtin' });
    for (const item of project) this.byId.set(item.id, { item, source: 'project' });
  }

  get(id: string | undefined): T | undefined {
    return id ? this.byId.get(id)?.item : undefined;
  }

  sourceOf(id: string): ItemSource | undefined {
    return this.byId.get(id)?.source;
  }

  all(): Sourced<T>[] {
    return [...this.byId.values()].sort((a, b) => a.item.name.localeCompare(b.item.name));
  }

  items(): T[] {
    return this.all().map((s) => s.item);
  }

  ids(): string[] {
    return [...this.byId.keys()];
  }
}

export interface CatalogSet {
  devices: DeviceDefinition[];
  racks: RackTemplate[];
  optics: OpticDefinition[];
  cableMedia: CableMedia[];
}

/** Resolves library ids over the built-in catalog and the project. */
export class Library {
  readonly devices: ItemCollection<DeviceDefinition>;
  readonly racks: ItemCollection<RackTemplate>;
  readonly optics: ItemCollection<OpticDefinition>;
  readonly cableMedia: ItemCollection<CableMedia>;

  constructor(builtin: CatalogSet, project: CatalogSet, hiddenBuiltins: readonly string[] = []) {
    const hidden = new Set(hiddenBuiltins);
    this.devices = new ItemCollection(builtin.devices, project.devices, hidden);
    this.racks = new ItemCollection(builtin.racks, project.racks, hidden);
    this.optics = new ItemCollection(builtin.optics, project.optics, hidden);
    this.cableMedia = new ItemCollection(builtin.cableMedia, project.cableMedia, hidden);
  }
}
