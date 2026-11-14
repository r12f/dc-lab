import { useState } from 'react';

/** Selected port refs on a device drawing; additive click toggles. */
export function usePortSelection() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const click = (ref: string, additive: boolean) =>
    setSelected((s) => {
      if (!additive) return new Set(s.size === 1 && s.has(ref) ? [] : [ref]);
      const n = new Set(s);
      if (n.has(ref)) n.delete(ref);
      else n.add(ref);
      return n;
    });
  return { selected, click, clear: () => setSelected(new Set()), set: (refs: string[]) => setSelected(new Set(refs)) };
}
