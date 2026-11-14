import type { CatalogSet } from '../library/library';
import type { DeviceDefinition } from '../device/types';
import type { RackTemplate } from '../rack/types';
import type { CableMedia, OpticDefinition } from '../optics/types';

/** The built-in catalog for tests (same files the app bundles). */
function load<T>(kind: string): T[] {
  const modules = import.meta.glob('../../catalog/*/*.json', { eager: true }) as Record<string, { default: unknown }>;
  return Object.entries(modules).filter(([k]) => k.includes(`/catalog/${kind}/`)).map(([, m]) => m.default as T);
}

/** Test-only devices that exercise model features (CPO/NPO ports, QSFP-DD800 compat, GPU server…); not shipped. */
function fixtures(): DeviceDefinition[] {
  const modules = import.meta.glob('./fixtures/devices/*.json', { eager: true }) as Record<string, { default: unknown }>;
  return Object.values(modules).map((m) => m.default as DeviceDefinition);
}

/** The shipped built-in catalog, exactly as the app bundles it. */
export const SHIPPED_CATALOG: CatalogSet = {
  devices: load<DeviceDefinition>('devices'),
  racks: load<RackTemplate>('racks'),
  optics: load<OpticDefinition>('optics'),
  cableMedia: load<CableMedia>('cables'),
};

export const BUILTIN_CATALOG_FOR_TESTS: CatalogSet = {
  devices: [...load<DeviceDefinition>('devices'), ...fixtures()],
  racks: load<RackTemplate>('racks'),
  optics: load<OpticDefinition>('optics'),
  cableMedia: load<CableMedia>('cables'),
};
