import type { Library } from '../library/library';
import type { RackDesign } from './types';

/**
 * Caches a derived value per (library, design) object pair. Designs and the library are immutable snapshots (every
 * edit makes a new object), so a value stays valid for as long as both objects are the same; old ones are dropped
 * with them (WeakMap).
 */
export function memoByDesign<T>(fn: (lib: Library, design: RackDesign) => T): (lib: Library, design: RackDesign) => T {
  const cache = new WeakMap<Library, WeakMap<RackDesign, T>>();
  return (lib, design) => {
    let perLib = cache.get(lib);
    if (!perLib) { perLib = new WeakMap(); cache.set(lib, perLib); }
    if (perLib.has(design)) return perLib.get(design) as T;
    const v = fn(lib, design);
    perLib.set(design, v);
    return v;
  };
}
