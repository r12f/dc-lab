import { formatTiles } from '../../domain/layout/tiles';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { buildDcBom, computeDcMetrics } from '../../domain/layout/metrics';
import { formatPower, formatWeight } from '../../domain/units';
import { Section } from '../../ui/fields';
import { StatGrid, WarningList } from '../../ui/stat-grid';
import { BomTable } from '../../ui/bom-table';

export function DcSummaryPanel({ lib, designs, layout }: { lib: Library; designs: DesignLookup; layout: DcLayout }) {
  const m = computeDcMetrics(lib, designs, layout);
  return (
    <>
      <Section title="DC totals">
        <StatGrid stats={[
          { label: 'Racks', value: String(m.rackCount) },
          { label: 'Typical power', value: formatPower(m.typicalW) },
          { label: 'Max power', value: formatPower(m.maxW) },
          { label: 'Weight', value: formatWeight(m.weightKg) },
        ]} />
        <table className="table">
          <thead><tr><th>Row</th><th className="num">Tiles</th><th className="num">Power / budget</th></tr></thead>
          <tbody>
            {m.rows.map((r) => {
              const row = layout.rows.find((x) => x.id === r.rowId);
              return (
                <tr key={r.rowId} className={r.typicalW > r.budgetW ? 'warn' : ''}>
                  <td>{row?.name}</td>
                  <td className="num">{`${formatTiles(r.tilesUsed)} / ${row?.tileCount ?? 0}`}</td>
                  <td className="num">{`${formatPower(r.typicalW)} / ${formatPower(r.budgetW)}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <WarningList warnings={m.warnings} />
      </Section>
      <Section title="DC BOM">
        <BomTable lines={buildDcBom(lib, designs, layout)} filename={layout.id} />
      </Section>
    </>
  );
}
