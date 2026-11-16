import type { Library } from '../../domain/library/library';
import type { RackDesign } from '../../domain/design/types';
import { computeRackMetrics } from '../../domain/design/metrics';
import { buildRackBom } from '../../domain/bom/rack-bom';
import { formatPower, formatWeight } from '../../domain/units';
import { StatGrid, WarningList } from '../../ui/stat-grid';
import { BomTable } from '../../ui/bom-table';
import { BomTreeTable } from '../../ui/bom-tree-table';
import { buildRackBomTree } from '../../domain/bom/rack-bom-tree';
import { Section } from '../../ui/fields';

export function RackSummaryPanel({ lib, design, onPick, onSiAdjustable }: {
  lib: Library; design: RackDesign; onPick?(pickKey: string, itemId: string | undefined): void; onSiAdjustable?(siKey: string, on: boolean): void;
}) {
  const m = computeRackMetrics(lib, design);
  const bom = buildRackBom(lib, design);
  const tree = buildRackBomTree(lib, design);
  return (
    <>
      <StatGrid stats={[
        { label: 'Units', value: `${m.usedUnits} / ${m.totalUnits}` },
        { label: 'Devices', value: String(m.deviceCount) },
        { label: 'Typical power', value: formatPower(m.typicalW) },
        { label: 'Max power', value: formatPower(m.maxW), warn: m.maxW > m.rackMaxPowerW },
        { label: 'Supply capacity', value: formatPower(m.supplyCapacityW), warn: m.supplyCapacityW > 0 && m.maxW > m.supplyCapacityW },
        ...(m.coolingCapacityKw ? [{ label: 'Cooling capacity', value: `${m.coolingCapacityKw} kW` }] : []),
        { label: 'Rack rating', value: formatPower(m.rackMaxPowerW) },
        { label: 'Total weight', value: formatWeight(m.totalWeightKg) },
        { label: 'Payload / limit', value: `${m.deviceWeightKg.toFixed(0)} / ${m.maxLoadKg} kg`, warn: m.deviceWeightKg > m.maxLoadKg },
      ]} />
      <WarningList warnings={m.warnings} />
      <Section title="BOM">
        {tree ? <BomTreeTable root={tree} filename={design.id} itemsOf={(id) => lib.variants.of(id)} onPick={onPick} onSiAdjustable={onSiAdjustable} /> : <BomTable lines={bom} filename={design.id} />}
      </Section>
    </>
  );
}
