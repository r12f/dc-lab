import { genderedConnector } from './connectors';
import type { CableEnd, CableMedia } from './types';
import { defaultFibers } from './connectors';

/** One fiber path: A connector/fiber -> B connector/fiber (all 1-based). */
export interface FiberLink {
  a: { connector: number; fiber: number };
  b: { connector: number; fiber: number };
}

export interface FiberSummary {
  links: FiberLink[];
  /** Fibers on each end that carry nothing (asymmetric cables). */
  unusedA: number;
  unusedB: number;
  /** Fibers between each (A connector, B connector) pair: pairs[i][j]. */
  pairs: number[][];
}

const perConnector = (e: CableEnd) => e.fibers ?? defaultFibers(e.connector) ?? 0;

/** Position after polarity on the B side of a connector with `n` fibers. */
function polarize(pos: number, n: number, polarity: CableMedia['polarity']): number {
  if (polarity === 'B') return n + 1 - pos;
  if (polarity === 'C') return pos % 2 === 1 ? Math.min(n, pos + 1) : pos - 1;
  return pos;
}

/**
 * Fiber map of a cable. Straight: fibers numbered across connectors in order, cut at the shorter end.
 * Shuffle: A connector i sends equal groups to every B connector j, landing in B connector j at group i.
 */
export function fiberMap(c: CableMedia): FiberSummary {
  const { a, b } = c.ends;
  const fa = perConnector(a);
  const fb = perConnector(b);
  const totalA = a.count * fa;
  const totalB = b.count * fb;
  const links: FiberLink[] = [];
  if (c.mapping === 'shuffle' && a.count > 0 && b.count > 0) {
    const group = Math.min(Math.floor(fa / b.count), Math.floor(fb / a.count));
    for (let i = 0; i < a.count; i++) {
      for (let j = 0; j < b.count; j++) {
        for (let k = 0; k < group; k++) {
          const bPos = i * group + k + 1;
          links.push({ a: { connector: i + 1, fiber: j * group + k + 1 }, b: { connector: j + 1, fiber: polarize(bPos, fb, c.polarity) } });
        }
      }
    }
  } else {
    const used = Math.min(totalA, totalB);
    for (let n = 0; n < used; n++) {
      const bPos = (n % fb) + 1;
      links.push({ a: { connector: Math.floor(n / fa) + 1, fiber: (n % fa) + 1 }, b: { connector: Math.floor(n / fb) + 1, fiber: polarize(bPos, fb, c.polarity) } });
    }
  }
  const pairs = Array.from({ length: a.count }, () => Array<number>(b.count).fill(0));
  for (const l of links) pairs[l.a.connector - 1][l.b.connector - 1]++;
  return { links, unusedA: totalA - links.length, unusedB: totalB - links.length, pairs };
}

/** Short description of an end, e.g. "4x MPO-8 (male)". */
export function describeEnd(e: CableEnd): string {
  return `${e.count}x ${genderedConnector(e.connector, e.gender)}`;
}

/** "1x MMC-16 → 2x MPO-8 (Y)", "4x MPO-8 ⇄ 4x MPO-8 shuffle", "LC". */
export function cableSummary(c: CableMedia): string {
  const { a, b } = c.ends;
  const ca = genderedConnector(a.connector, a.gender);
  const cb = genderedConnector(b.connector, b.gender);
  const same = a.count === b.count && ca === cb;
  if (same && a.count === 1 && c.mapping === 'straight') return ca;
  const arrow = `${a.count}x ${ca} → ${b.count}x ${cb}`;
  return c.mapping === 'shuffle' ? `${arrow} shuffle` : arrow;
}
