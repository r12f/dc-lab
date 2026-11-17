import { formatTiles } from '../../domain/layout/tiles';
import type { Library } from '../../domain/library/library';
import type { DcLayout } from '../../domain/layout/types';
import type { DesignLookup } from '../../domain/layout/tiles';
import { buildDcBomGroups, computeDcMetrics } from '../../domain/layout/metrics';
import type { BomNode } from '../../domain/bom/rack-bom-tree';
import { BomTreeTable } from '../../ui/bom-tree-table';
import { infraGroups } from '../../domain/layout/infra';
import { formatPower, formatWeight } from '../../domain/units';
import { Section } from '../../ui/fields';
import { StatGrid, WarningList } from '../../ui/stat-grid';
import type { LayoutEditor } from './use-layout-editor';
import type { BomLine } from '../../domain/bom/types';

/** Power / CDU groups: capacity of the sidecars vs max power of the IT racks they serve. */
function InfraTable({ lib, designs, layout }: { lib: Library; designs: DesignLookup; layout: DcLayout }) {
  const groups = [...infraGroups(lib, designs, layout, 'power'), ...infraGroups(lib, designs, layout, 'cdu')];
  if (groups.length === 0) return null;
  const label = (id: string) => layout.assignments.find((a) => a.id === id)?.label ?? id;
  return (
    <table className="table">
      <thead><tr><th>Power / CDU</th><th>Serves</th><th className="num">Capacity / IT max</th></tr></thead>
      <tbody>
        {groups.map((g) => (
          <tr key={`${g.role}:${g.infraIds.join()}`} className={g.ok && g.itIds.length ? '' : 'warn'}>
            <td>{`${g.role === 'power' ? 'Power' : 'CDU'} ${g.infraIds.map(label).join(' + ')}`}</td>
            <td>{g.itIds.map(label).join(', ') || '—'}</td>
            <td className="num">{`${g.capacityKw.toFixed(1)} / ${g.loadKw.toFixed(1)} kW`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * DC BOM tree: "In-rack" — everything the racks hold (items picked per rack design in the Rack Designer, read-only
 * here) — and "Cross-rack cables" — cables between racks, whose items are picked here.
 */
function dcBomTree(lib: Library, designs: DesignLookup, layout: DcLayout): BomNode {
  const { inRack, crossRack } = buildDcBomGroups(lib, designs, layout);
  const leaf = (l: BomLine, pickable: boolean): BomNode => ({ key: l.key, label: l.item, line: pickable ? l : { ...l, pickKey: undefined }, children: [] });
  return {
    key: `dc:${layout.id}`, label: layout.name, children: [
      { key: 'dc:in-rack', label: 'In-rack (items picked in the Rack Designer)', children: inRack.map((l) => leaf(l, false)) },
      { key: 'dc:cross-rack', label: 'Cross-rack cables', children: crossRack.map((l) => leaf(l, true)) },
    ],
  };
}

export function DcSummaryPanel({ lib, designs, layout, editor }: { lib: Library; designs: DesignLookup; layout: DcLayout; editor?: LayoutEditor }) {
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
          <thead><tr><th>Row</th><th className="num">Tiles</th><th className="num">Power / budget</th><th className="num">PDU draw</th></tr></thead>
          <tbody>
            {m.rows.map((r) => {
              const row = layout.rows.find((x) => x.id === r.rowId);
              return (
                <tr key={r.rowId} className={r.typicalW > r.budgetW ? 'warn' : ''}>
                  <td>{row?.name}</td>
                  <td className="num">{`${formatTiles(r.tilesUsed)} / ${row?.tileCount ?? 0}`}</td>
                  <td className="num">{`${formatPower(r.typicalW)} / ${formatPower(r.budgetW)}`}</td>
                  <td className="num" title="Max power drawn from PDUs (power racks excluded)">{r.pduCount ? `${r.demandKw.toFixed(1)} kW / ${r.pduCount} PDU` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <InfraTable lib={lib} designs={designs} layout={layout} />
        <WarningList warnings={m.warnings} />
      </Section>
      <Section title="DC BOM">
        <BomTreeTable filename={layout.id} root={dcBomTree(lib, designs, layout)}
          itemsOf={(id) => lib.variants.of(id)} onPick={editor?.pickBomItem} />
      </Section>
    </>
  );
}
