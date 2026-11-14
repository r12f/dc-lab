/**
 * Connector families: connectors that physically mate. MPO-8/12 share the 12-position ferrule;
 * "MMC" and "MMC-16" are the same 16-fiber connector.
 */
const FAMILY: Record<string, string> = { 'MPO-8': 'MPO-12', MPO: 'MPO-12', MMC: 'MMC-16' };

export function connectorFamily(connector: string): string {
  const c = connector.trim().toUpperCase();
  return FAMILY[c] ?? c;
}

/** IEC 60320 power connectors mate with their counterpart only: a C13 cord end plugs into a C14 inlet. */
const POWER_MATE: Record<string, string> = { C13: 'C14', C14: 'C13', C15: 'C16', C16: 'C15', C19: 'C20', C20: 'C19' };

export function connectorsMate(a: string, b: string): boolean {
  const x = a.trim().toUpperCase();
  const y = b.trim().toUpperCase();
  if (POWER_MATE[x] || POWER_MATE[y]) return POWER_MATE[x] === y;
  return connectorFamily(a) === connectorFamily(b);
}

/** Multi-fiber connectors carry a gender (pins) and polarity. */
export function isMultiFiber(connector: string): boolean {
  return /^(MPO|MMC)/i.test(connector.trim());
}

/**
 * Connector name with its gender for multi-fiber connectors: "MMC-16F" (female, unpinned) or
 * "MMC-16M" (male, pinned). Duplex connectors (LC, SN, CS) and unknown gender stay as they are.
 */
export function genderedConnector(connector: string, gender?: 'male' | 'female'): string {
  if (!gender || !isMultiFiber(connector)) return connector;
  return `${connector}${gender === 'male' ? 'M' : 'F'}`;
}

/** Transceiver receptacles for multi-fiber connectors are pinned: a module face is male. */
export const MODULE_FACE_GENDER = 'male' as const;

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
