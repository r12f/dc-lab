import type { VGroup, VirtualTopo } from './virtual';

/** Ports without a lane suffix are laid out in rows of this many, in pool order. */
const FALLBACK_COLS = 64;

/** Cage a port sits in: the port without its lane letters (`etp12c` -> `etp12`); a port without lanes is its own cage. */
export function cageOf(port: string): string {
  const m = /^(.*?\d+)[a-z]+$/.exec(port);
  return m ? m[1] : port;
}

/** Every port of a device as a grid: a column per port number (gaps kept), a row per lane (`etp12c`: etp12, c). */
export interface PortLayout {
  cols: string[];
  rows: string[];
  cells: { port: string; col: number; row: number }[];
}

/** Layout of every port a group's pools name (the full cage: every column x lane, listed or not). */
export function portLayout(g: VGroup): PortLayout {
  const ports = [...new Set(Object.values(g.poolNames).flat())];
  const parsed = ports.map((port) => /^(.*?)(\d+)([a-z]+)$/.exec(port));
  if (ports.length && parsed.every(Boolean)) {
    const lanes = [...new Set(parsed.map((m) => m![3]))].sort((a, b) => a.length - b.length || a.localeCompare(b));
    const nums = new Map<string, number[]>();
    for (const m of parsed) {
      const list = nums.get(m![1]) ?? [];
      list.push(Number(m![2]));
      nums.set(m![1], list);
    }
    const cols: string[] = [];
    for (const [prefix, ns] of nums) for (let n = Math.min(...ns); n <= Math.max(...ns); n++) cols.push(`${prefix}${n}`);
    return { cols, rows: lanes, cells: cols.flatMap((c, col) => lanes.map((r, row) => ({ port: `${c}${r}`, col, row }))) };
  }
  return {
    cols: Array.from({ length: Math.min(ports.length, FALLBACK_COLS) }, (_, i) => String(i + 1)),
    rows: Array.from({ length: Math.ceil(ports.length / FALLBACK_COLS) }, (_, i) => String(i + 1)),
    cells: ports.map((port, i) => ({ port, col: i % FALLBACK_COLS, row: Math.floor(i / FALLBACK_COLS) })),
  };
}

/** Port use of one device of a group: which link spec takes each port, and how many each pool has used. */
export interface PortUse {
  /** Port -> index of the link spec using it. */
  owner: Map<string, number>;
  /** Pool -> ports used. */
  used: Map<string, number>;
  /** Port -> pool it belongs to. */
  pool: Map<string, string>;
}

/**
 * Ports one device of a group uses: each pool is filled in order, link specs in topo order, each taking the ports
 * one device needs for it (`fromPorts` / `toPorts`).
 */
export function portUse(g: VGroup, v: VirtualTopo): PortUse {
  const owner = new Map<string, number>(); const used = new Map<string, number>(); const pool = new Map<string, string>();
  for (const [name, ports] of Object.entries(g.poolNames)) {
    for (const port of ports) pool.set(port, name);
    let at = 0;
    v.links.forEach((l, li) => {
      for (const [e, n] of [[l.from, l.fromPorts], [l.to, l.toPorts]] as const) {
        if (e.group !== g.name || e.ports !== name || n === undefined) continue;
        for (let k = 0; k < Math.round(n) && at < ports.length; k++, at++) owner.set(ports[at], li);
      }
    });
    used.set(name, at);
  }
  return { owner, used, pool };
}
