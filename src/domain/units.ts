export type UnitSystem = 'RU' | 'OU';

/** Height of one mounting unit in millimetres. */
export const UNIT_MM: Record<UnitSystem, number> = { RU: 44.45, OU: 48 };

export interface Height {
  units: number;
  system: UnitSystem;
}

/** Units a device of `height` occupies in a rack using `rackSystem`. */
export function unitsIn(height: Height, rackSystem: UnitSystem): number {
  if (height.units === 0) return 0;
  if (height.system === rackSystem) return height.units;
  const mm = height.units * UNIT_MM[height.system];
  return Math.ceil(mm / UNIT_MM[rackSystem] - 1e-6);
}

export function formatHeight(h: Height): string {
  return h.units === 0 ? '0U' : `${h.units}${h.system}`;
}

export function formatPower(w: number): string {
  return w >= 1000 ? `${(w / 1000).toFixed(2)} kW` : `${Math.round(w)} W`;
}

export function formatWeight(kg: number): string {
  return `${kg.toFixed(1)} kg`;
}

/** Speed for display: "800G", "1.6T", "3.2T" (Tbps from 1000G up). */
export function formatGbps(gbps: number): string {
  return gbps >= 1000 ? `${Math.round(gbps / 100) / 10}T` : `${gbps}G`;
}
