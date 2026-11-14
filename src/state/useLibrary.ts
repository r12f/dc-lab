import { useMemo } from 'react';
import { BUILTIN_CATALOG } from '../catalog';
import { Library } from '../domain/library/Library';
import { useAppStore } from './store';

/** Library over built-in catalog + current project, rebuilt only when project catalogs change. */
export function useLibrary(): Library {
  const devices = useAppStore((s) => s.project.devices);
  const racks = useAppStore((s) => s.project.racks);
  const optics = useAppStore((s) => s.project.optics);
  const cableMedia = useAppStore((s) => s.project.cableMedia);
  const hidden = useAppStore((s) => s.project.hiddenBuiltins);
  return useMemo(
    () => new Library(BUILTIN_CATALOG, { devices, racks, optics, cableMedia }, hidden),
    [devices, racks, optics, cableMedia, hidden],
  );
}
