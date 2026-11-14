import type { DeviceDefinition } from '../domain/device/types';
import type { RackTemplate } from '../domain/rack/types';
import type { CableMedia, OpticDefinition } from '../domain/optics/types';
import type { CatalogSet } from '../domain/library/library';

/** Built-in catalog: one JSON file per item, bundled at build time. */
function load<T>(modules: Record<string, unknown>): T[] {
  return Object.values(modules).map((m) => (m as { default: T }).default);
}

export const BUILTIN_CATALOG: CatalogSet = {
  devices: load<DeviceDefinition>(import.meta.glob('./devices/*.json', { eager: true })),
  racks: load<RackTemplate>(import.meta.glob('./racks/*.json', { eager: true })),
  optics: load<OpticDefinition>(import.meta.glob('./optics/*.json', { eager: true })),
  cableMedia: load<CableMedia>(import.meta.glob('./cables/*.json', { eager: true })),
};
