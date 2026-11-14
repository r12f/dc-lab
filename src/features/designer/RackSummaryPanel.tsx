import type { Library } from '../../domain/library/Library';
import type { RackDesign } from '../../domain/design/types';
import { computeRackMetrics } from '../../domain/design/metrics';
import { buildRackBom } from '../../domain/bom/rackBom';
import { formatPower, formatWeight } from '../../domain/units';
import { StatGrid, WarningList } from '../../ui/StatGrid';
import { BomTable } from '../../ui/BomTable';
import { Section } from '../../ui/fields';

export function RackSummaryPanel({ lib, design }: { lib: Library; design: RackDesign }) {
  const m = computeRackMetrics(lib, design);
  const bom = buildRackBom(lib, design);
  return (
    <>
      <StatGrid stats={[
        { label: 'Units', value: `${m.usedUnits} / ${m.totalUnits}` },
        { label: 'Devices', value: String(m.deviceCount) },
        { label: 'Typical power', value: formatPower(m.typicalW) },
        { label: 'Max power', value: formatPower(m.maxW), warn: m.maxW > m.rackMaxPowerW },
        { label: 'Supply capacity', value: formatPower(m.supplyCapacityW), warn: m.supplyCapacityW > 0 && m.maxW > m.supplyCapacityW },
        { label: 'Rack rating', value: formatPower(m.rackMaxPowerW) },
        { label: 'Total weight', value: formatWeight(m.totalWeightKg) },
        { label: 'Payload / limit', value: `${m.deviceWeightKg.toFixed(0)} / ${m.maxLoadKg} kg`, warn: m.deviceWeightKg > m.maxLoadKg },
      ]} />
      <WarningList warnings={m.warnings} />
      <Section title="BOM">
        <BomTable lines={bom} filename={design.id} />
      </Section>
    </>
  );
}
