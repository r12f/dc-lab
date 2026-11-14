import type { Library } from '../../domain/library/Library';

/** Optic choices compatible with a connector, with a leading "none" entry. */
export function opticOptions(lib: Library, connector: string, noneLabel = 'none') {
  return [
    { value: '', label: noneLabel },
    ...lib.optics.items().filter((o) => o.connector === connector).map((o) => ({ value: o.id, label: o.name })),
  ];
}
