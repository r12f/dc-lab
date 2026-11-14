import type { Library } from '../../domain/library/library';
import type { RackAssignment } from '../../domain/layout/types';
import { formatTiles, tileWidthOf, type DesignLookup } from '../../domain/layout/tiles';
import { computeRackMetrics } from '../../domain/design/metrics';
import { formatPower, formatWeight } from '../../domain/units';

/** Multi-line summary of an assigned rack, shown as a hover tooltip. */
export function rackSummary(lib: Library, designs: DesignLookup, a: RackAssignment): string[] {
  const design = designs(a.designId);
  if (!design) return [a.label, `Unknown design ${a.designId}`];
  const rack = lib.racks.get(design.templateId);
  const m = computeRackMetrics(lib, design);
  const tiles = tileWidthOf(lib, design);
  const counts = new Map<string, number>();
  for (const p of design.placements) {
    const name = lib.devices.get(p.deviceId)?.name ?? p.deviceId;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [
    `${a.label} — ${design.name}`,
    `${rack?.name ?? design.templateId} · ${formatTiles(tiles)} tile(s) from #${formatTiles(a.startTile + 1)}`,
    `Units ${m.usedUnits}/${m.totalUnits} · ${m.deviceCount} device(s)`,
    `Power ${formatPower(m.typicalW)} typ / ${formatPower(m.maxW)} max`,
    `Weight ${formatWeight(m.totalWeightKg)}`,
    ...[...counts].map(([n, c]) => `  ${c}× ${n}`),
    ...m.warnings.map((w) => `⚠ ${w}`),
  ];
}
