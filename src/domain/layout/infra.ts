import type { Library } from '../library/library';
import { computeRackMetrics, type RackMetrics } from '../design/metrics';
import { rackRole, type RackRole } from '../rack/types';
import { formatPower } from '../units';
import type { DcLayout, RackAssignment } from './types';
import { spanOf, type DesignLookup } from './tiles';

const EPS = 1e-9;

export type InfraRole = Exclude<RackRole, 'it'>;

/** Role of an assigned rack: from its design's rack template kind. */
export function assignmentRole(lib: Library, designs: DesignLookup, a: RackAssignment): RackRole {
  const d = designs(a.designId);
  const t = d && lib.racks.get(d.templateId);
  return t ? rackRole(t.kind) : 'it';
}

/**
 * IT racks a power / CDU rack serves. Explicit `serves` wins (unknown or non-IT ids dropped); otherwise the
 * adjacent IT racks in its row: walking outward both ways over touching racks, skipping infra racks of the
 * other role, stopping at a gap or at another rack of the same role.
 */
export function servedRacks(lib: Library, designs: DesignLookup, layout: DcLayout, infra: RackAssignment): RackAssignment[] {
  const role = assignmentRole(lib, designs, infra);
  if (role === 'it') return [];
  const isIt = (a: RackAssignment) => assignmentRole(lib, designs, a) === 'it';
  if (infra.serves) {
    return infra.serves.map((id) => layout.assignments.find((a) => a.id === id)).filter((a): a is RackAssignment => !!a && isIt(a));
  }
  const row = layout.assignments.filter((a) => a.rowId === infra.rowId)
    .sort((a, b) => a.startTile - b.startTile);
  const i = row.findIndex((a) => a.id === infra.id);
  const out: RackAssignment[] = [];
  for (const dir of [-1, 1]) {
    let prev = infra;
    for (let j = i + dir; j >= 0 && j < row.length; j += dir) {
      const a = row[j];
      const [p, q] = dir > 0 ? [spanOf(lib, designs, prev), spanOf(lib, designs, a)] : [spanOf(lib, designs, a), spanOf(lib, designs, prev)];
      if (Math.abs(p.end - q.start) > EPS) break;
      const r = assignmentRole(lib, designs, a);
      if (r === role) break;
      if (r === 'it') out.push(a);
      prev = a;
    }
  }
  return out.sort((a, b) => a.startTile - b.startTile);
}

export interface InfraGroup {
  role: InfraRole;
  /** Power / CDU racks pooled because they serve overlapping IT racks. */
  infraIds: string[];
  itIds: string[];
  /** Supply (power shelves) or cooling (CDUs) capacity, kW. */
  capacityKw: number;
  /** Max power of the served IT racks, kW (heat to remove = power drawn). */
  loadKw: number;
  ok: boolean;
}

/**
 * Groups for one role: power/CDU racks that serve a common IT rack are pooled (union-find), and each group's
 * capacity is checked against the max power of the IT racks it serves.
 */
export function infraGroups(lib: Library, designs: DesignLookup, layout: DcLayout, role: InfraRole): InfraGroup[] {
  const metrics = new Map<string, RackMetrics>();
  const m = (a: RackAssignment) => {
    if (!metrics.has(a.designId)) { const d = designs(a.designId); if (d) metrics.set(a.designId, computeRackMetrics(lib, d)); }
    return metrics.get(a.designId);
  };
  const infra = layout.assignments.filter((a) => assignmentRole(lib, designs, a) === role);
  const parent = new Map(infra.map((a) => [a.id, a.id]));
  const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!));
  const served = new Map(infra.map((a) => [a.id, servedRacks(lib, designs, layout, a)]));
  const owner = new Map<string, string>();
  for (const a of infra) {
    for (const it of served.get(a.id)!) {
      const o = owner.get(it.id);
      if (o) parent.set(find(a.id), find(o));
      else owner.set(it.id, a.id);
    }
  }
  const groups = new Map<string, InfraGroup>();
  for (const a of infra) {
    const root = find(a.id);
    const g = groups.get(root) ?? { role, infraIds: [], itIds: [], capacityKw: 0, loadKw: 0, ok: true };
    g.infraIds.push(a.id);
    const rm = m(a);
    g.capacityKw += role === 'power' ? (rm?.supplyCapacityW ?? 0) / 1000 : rm?.coolingCapacityKw ?? 0;
    for (const it of served.get(a.id)!) if (!g.itIds.includes(it.id)) g.itIds.push(it.id);
    groups.set(root, g);
  }
  for (const g of groups.values()) {
    g.loadKw = g.itIds.reduce((n, id) => {
      const a = layout.assignments.find((x) => x.id === id);
      return n + (a ? (m(a)?.maxW ?? 0) / 1000 : 0);
    }, 0);
    g.ok = g.capacityKw >= g.loadKw;
  }
  return [...groups.values()];
}

/** Warnings for under-sized power / cooling groups and sidecars serving nothing. */
export function infraWarnings(lib: Library, designs: DesignLookup, layout: DcLayout): string[] {
  const label = (id: string) => layout.assignments.find((a) => a.id === id)?.label ?? id;
  const out: string[] = [];
  for (const role of ['power', 'cdu'] as const) {
    const what = role === 'power' ? 'supply' : 'cooling';
    for (const g of infraGroups(lib, designs, layout, role)) {
      const names = g.infraIds.map(label).join(' + ');
      if (g.itIds.length === 0) out.push(`${names}: serves no IT rack`);
      else if (!g.ok) {
        out.push(`${names}: ${what} ${formatPower(g.capacityKw * 1000)} < ${formatPower(g.loadKw * 1000)} max of ${g.itIds.map(label).join(', ')}`);
      }
    }
  }
  return out;
}
