import type { CatalogItem, ItemSource, Sourced } from '../catalog-item';
import type { DeviceDefinition } from '../device/types';
import type { RackTemplate } from '../rack/types';
import type { CableMedia, OpticDefinition } from '../optics/types';
import type { HasProperties, PropertyValue } from '../properties/types';
import type { ItemVariant } from '../items/types';
import { VariantIndex } from '../items/variants';
import type { BuiltinProfiles } from '../project/types';

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
  /** Vendor items of device/optic/cable item types (project only). */
  variants?: ItemVariant[];
}

/** Resolves library ids over the built-in catalog and the project. */
export class Library {
  readonly devices: ItemCollection<DeviceDefinition>;
  readonly racks: ItemCollection<RackTemplate>;
  readonly optics: ItemCollection<OpticDefinition>;
  readonly cableMedia: ItemCollection<CableMedia>;
  readonly variants: VariantIndex;

  constructor(
    builtin: CatalogSet,
    project: CatalogSet,
    hiddenBuiltins: readonly string[] = [],
    builtinProperties: Readonly<Record<string, Record<string, PropertyValue>>> = {},
    builtinProfiles: Readonly<Record<string, BuiltinProfiles>> = {},
  ) {
    const hidden = new Set(hiddenBuiltins);
    /** Built-in items with the project's custom property values merged in. */
    const withProps = <T extends HasProperties & CatalogItem>(items: readonly T[]): T[] =>
      items.map((i) => (builtinProperties[i.id] ? { ...i, properties: { ...i.properties, ...builtinProperties[i.id] } } : i));
    // Built-in devices keep their definition; their breakout profiles may be edited in the project.
    const withProfiles = builtin.devices.map((d) => (builtinProfiles[d.id] ? { ...d, ...builtinProfiles[d.id] } : d));
    this.devices = new ItemCollection(withProfiles, project.devices, hidden);
    this.racks = new ItemCollection(withProps(builtin.racks), project.racks, hidden);
    this.optics = new ItemCollection(builtin.optics, project.optics, hidden);
    this.cableMedia = new ItemCollection(builtin.cableMedia, project.cableMedia, hidden);
    const types = [
      ...this.devices.items().map((i) => ({ target: 'device' as const, id: i.id, name: i.name })),
      ...this.optics.items().map((i) => ({ target: 'optic' as const, id: i.id, name: i.name })),
      ...this.cableMedia.items().map((i) => ({ target: 'cable' as const, id: i.id, name: i.name })),
    ];
    this.variants = new VariantIndex(types, project.variants ?? [], hidden, builtinProperties);
  }
}
