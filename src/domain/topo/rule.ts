import { keyVars, type VEnd, type VLink } from './virtual';

const fmt = (n?: number) => (n === undefined ? '?' : Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(1));
const keyName = (e: VEnd) => keyVars(e.key ?? '').join('.');
const filters = (e: VEnd) => Object.entries(e.filters).map(([k, v]) => ` ${k} ${v}`).join('');

/**
 * A link spec as two lines of text: its name and total links; how instances pair (by map, by equal key, or all),
 * the pattern with devices per pair, and the ports one device uses on each side.
 */
export function ruleText(l: VLink): [string, string] {
  const fk = keyName(l.from); const tk = keyName(l.to);
  const pairing = l.map.length
    ? `${l.fanIn} ${l.from.group} ${fk}s → 1 ${l.to.group} ${tk} (map)`
    : fk && tk ? `${l.from.group} ${fk} k → ${l.to.group} ${tk} k`
      : fk ? `each ${l.from.group} ${fk} → all ${l.to.group}${filters(l.to)}`
        : `all ${l.from.group}${filters(l.from)} → all ${l.to.group}${filters(l.to)}`;
  const shape = l.pattern === 'mesh'
    ? `mesh ${fmt(l.fromSize)} x ${fmt(l.toSize)} per pair`
    : `round-robin ${fmt(l.fromSize)} over ${fmt(l.toSize)}`;
  const ports = l.fromPorts !== undefined && l.toPorts !== undefined
    ? ` · each ${l.from.group} ${fmt(l.fromPorts)} ${l.from.ports} · each ${l.to.group} ${fmt(l.toPorts)} ${l.to.ports}` : '';
  return [`${l.name} · ${fmt(l.links)} links`, `${pairing} · ${shape}${l.perPair > 1 ? ` x${l.perPair}` : ''}${ports}`];
}

/** Full detail of a link spec (hover): both ends with key, filters and pool, and the map. */
export function ruleDetail(l: VLink): string {
  const end = (e: VEnd) => `${e.group}${e.key ? ` by ${e.key}` : ''}${Object.keys(e.filters).length ? ` where ${Object.entries(e.filters).map(([k, v]) => `${k}=${v}`).join(', ')}` : ''} [${e.ports}]`;
  return [
    `${l.name}: ${l.pattern}, ${l.perPair} per pair`,
    `from ${end(l.from)}`,
    `to ${end(l.to)}`,
    ...(l.map.length ? [`map: ${l.map.map((m) => `${m.from.join('+')}→${m.to}`).join(', ')}`] : []),
    `${fmt(l.links)} links`,
  ].join('\n');
}
