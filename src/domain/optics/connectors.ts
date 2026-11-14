/**
 * Connector families: connectors that physically mate. MPO-8/12 share the 12-position ferrule;
 * "MMC" and "MMC-16" are the same 16-fiber connector.
 */
const FAMILY: Record<string, string> = { 'MPO-8': 'MPO-12', MPO: 'MPO-12', MMC: 'MMC-16' };

export function connectorFamily(connector: string): string {
  const c = connector.trim().toUpperCase();
  return FAMILY[c] ?? c;
}

export function connectorsMate(a: string, b: string): boolean {
  return connectorFamily(a) === connectorFamily(b);
}

/** Multi-fiber connectors carry a gender (pins) and polarity. */
export function isMultiFiber(connector: string): boolean {
  return /^(MPO|MMC)/i.test(connector.trim());
}

/** Fibers a connector holds when not stated: MPO-8 -> 8, MPO-12 -> 12, MMC -> 16, LC/SN/CS -> 2. */
export function defaultFibers(connector: string): number | undefined {
  const c = connector.trim().toUpperCase();
  const n = /-(\d+)$/.exec(c)?.[1];
  if (n) return Number(n);
  if (c === 'MMC') return 16;
  if (c === 'MPO') return 12;
  if (['LC', 'SN', 'CS', 'SC'].includes(c)) return 2;
  return undefined;
}
