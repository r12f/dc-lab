import { useMemo } from 'react';
import { BUILTIN_CATALOG } from '../catalog';
import { Library } from '../domain/library/library';
import { useAppStore } from './store';

/** Library over built-in catalog + current project, rebuilt only when project catalogs change. */
export function useLibrary(): Library {
  const devices = useAppStore((s) => s.project.devices);
  const racks = useAppStore((s) => s.project.racks);
  const optics = useAppStore((s) => s.project.optics);
  const cableMedia = useAppStore((s) => s.project.cableMedia);
  const variants = useAppStore((s) => s.project.variants);
  const hidden = useAppStore((s) => s.project.hiddenBuiltins);
  const builtinProps = useAppStore((s) => s.project.builtinProperties);
  return useMemo(
    () => new Library(BUILTIN_CATALOG, { devices, racks, optics, cableMedia, variants }, hidden, builtinProps),
    [devices, racks, optics, cableMedia, variants, hidden, builtinProps],
  );
}
