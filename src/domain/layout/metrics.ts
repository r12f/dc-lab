import type { Library } from '../library/library';
import { computeRackMetrics, type RackMetrics } from '../design/metrics';
import { buildRackBom } from '../bom/rack-bom';
import { BomBuilder } from '../bom/bom-builder';
import type { BomLine } from '../bom/types';
import type { DcLayout } from './types';
import { tileWidthOf, type DesignLookup } from './tiles';

export interface RowMetrics {
  rowId: string;
  tilesUsed: number;
  typicalW: number;
  budgetW: number;
}

export interface DcMetrics {
  rackCount: number;
  typicalW: number;
  maxW: number;
  weightKg: number;
  rows: RowMetrics[];
  warnings: string[];
}

export function computeDcMetrics(lib: Library, designs: DesignLookup, layout: DcLayout): DcMetrics {
  const cache = new Map<string, RackMetrics>();
  const metricsOf = (id: string): RackMetrics | undefined => {
    const d = designs(id);
    if (!d) return undefined;
    if (!cache.has(id)) cache.set(id, computeRackMetrics(lib, d));
    return cache.get(id);
  };
  const m: DcMetrics = { rackCount: 0, typicalW: 0, maxW: 0, weightKg: 0, rows: [], warnings: [] };
  for (const row of layout.rows) {
    const r: RowMetrics = { rowId: row.id, tilesUsed: 0, typicalW: 0, budgetW: row.powerBudgetKw * 1000 };
    for (const a of layout.assignments.filter((x) => x.rowId === row.id)) {
      const rm = metricsOf(a.designId);
      if (!rm) {
        m.warnings.push(`${a.label}: unknown rack design`);
        continue;
      }
      m.rackCount++;
      r.tilesUsed += tileWidthOf(lib, designs(a.designId));
      r.typicalW += rm.typicalW;
      m.maxW += rm.maxW;
      m.weightKg += rm.totalWeightKg;
    }
    m.typicalW += r.typicalW;
    if (r.typicalW > r.budgetW) m.warnings.push(`${row.name}: ${(r.typicalW / 1000).toFixed(1)} kW exceeds ${row.powerBudgetKw} kW budget`);
    m.rows.push(r);
  }
  return m;
}

export function buildDcBom(lib: Library, designs: DesignLookup, layout: DcLayout): BomLine[] {
  const counts = new Map<string, number>();
  for (const a of layout.assignments) counts.set(a.designId, (counts.get(a.designId) ?? 0) + 1);
  const bom = new BomBuilder();
  for (const [id, n] of counts) {
    const d = designs(id);
    if (d) bom.addAll(buildRackBom(lib, d), n);
  }
  return bom.build();
}
