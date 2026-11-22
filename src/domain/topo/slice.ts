import { keyVars, type VGroup, type VirtualTopo } from './virtual';

/**
 * Which values of each partition key the diagram draws. A diagram is a slice of the topology: every level shows
 * at most MAX_SHOWN values (first, second, last) and every drawn link must have both ends drawn.
 */

/** Most values drawn per level (sets or devices): the first two, an ellipsis, the last. */
export const MAX_SHOWN = 3;

/** One key's drawn values, and the full order they come from (the ellipses mark the gaps in it). */
export interface KeySlice { values: string[]; order: string[] }
/** Group name -> key -> slice. Keys without an entry are drawn as first, second, ..., last of all values. */
export type Slice = Map<string, Map<string, KeySlice>>;

/** First two and last. */
export function pick(xs: string[]): string[] {
  return xs.length > MAX_SHOWN ? [...xs.slice(0, MAX_SHOWN - 1), xs[xs.length - 1]] : xs;
}

/** Values in `order` with null wherever values of it are skipped (before, between, after). */
export function withGaps(values: string[], order: string[]): (string | null)[] {
  const at = new Map(order.map((x, i) => [x, i]));
  const out: (string | null)[] = [];
  let prev = -1;
  for (const x of values) {
    const i = at.get(x) ?? prev + 1;
    if (i !== prev + 1) out.push(null);
    out.push(x);
    prev = i;
  }
  if (values.length && prev < order.length - 1) out.push(null);
  return out;
}

/** All values of a partition key: named sets, else 1..count. */
export function allValues(g: VGroup, key: string): string[] {
  const p = g.partitions.find((x) => x.key === key);
  if (!p) return [];
  return p.sizes ? Object.keys(p.sizes) : Array.from({ length: p.count }, (_, i) => String(i + 1));
}

/** Drawn values of a key: the slice's, else first, second, last of all values; with nulls for the gaps. */
export function drawnValues(slice: Slice, g: VGroup, key: string): (string | null)[] {
  const s = slice.get(g.name)?.get(key);
  if (s) return withGaps(s.values, s.order);
  const all = allValues(g, key);
  return withGaps(pick(all), all);
}

/**
 * Slice of a topology for the drawn nesting of each group.
 * - A mapped link: the first, second and last of its to values; for each, the first, second and last from values
 *   mapping onto it, in map order (so the ellipses fall between and inside the map groups).
 * - A keyed link without a map: the same values on both ends (copied from a side already sliced, else the first,
 *   second and last values both ends have).
 */
export function sliceTopo(v: VirtualTopo, nesting: Map<string, string[]>): Slice {
  const slice: Slice = new Map(v.groups.map((g) => [g.name, new Map()]));
  const group = new Map(v.groups.map((g) => [g.name, g]));
  const drawn = (g: string, k: string) => !!nesting.get(g)?.includes(k);
  for (const l of v.links) {
    if (!l.map.length || l.from.group === l.to.group) continue;
    const [ka] = keyVars(l.from.key ?? ''); const [kb] = keyVars(l.to.key ?? '');
    if (!ka || !kb || !drawn(l.to.group, kb)) continue;
    const to = slice.get(l.to.group)!; const from = slice.get(l.from.group)!;
    const targets = [...new Set(l.map.map((m) => m.to))];
    if (!to.has(kb)) to.set(kb, { values: pick(targets), order: targets });
    if (!from.has(ka) && drawn(l.from.group, ka)) {
      const tv = to.get(kb)!.values;
      from.set(ka, { values: tv.flatMap((t) => pick(l.map.filter((m) => m.to === t).flatMap((m) => m.from))), order: l.map.flatMap((m) => m.from) });
    }
  }
  // Same values on both ends of keyed links; repeat until nothing changes (chains of links).
  for (let changed = true; changed;) {
    changed = false;
    for (const l of v.links) {
      if (l.map.length || l.from.group === l.to.group) continue;
      const [ka] = keyVars(l.from.key ?? ''); const [kb] = keyVars(l.to.key ?? '');
      if (!ka || !kb || !drawn(l.from.group, ka) || !drawn(l.to.group, kb)) continue;
      const a = slice.get(l.from.group)!; const b = slice.get(l.to.group)!;
      if (a.has(ka) && b.has(kb)) continue;
      if (a.has(ka)) b.set(kb, a.get(ka)!);
      else if (b.has(kb)) a.set(ka, b.get(kb)!);
      else {
        const inB = new Set(allValues(group.get(l.to.group)!, kb));
        const common = allValues(group.get(l.from.group)!, ka).filter((x) => inB.has(x));
        a.set(ka, { values: pick(common), order: common });
        b.set(kb, a.get(ka)!);
      }
      changed = true;
    }
  }
  return slice;
}
