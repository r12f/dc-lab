import type { DcLayout, Facility, Rect } from '../../domain/layout/types';
import type { FloorPlan } from '../../domain/layout/floor-plan';
import type { FacilityLoads } from '../../domain/layout/facility-load';
import { paint } from '../../theme/paint';
import { useLabels } from './view-context';
import { FACILITY_COLORS } from './layout-colors';

/** Height of the row header box above the tiles (must match row-drawing). */
const HEADER_H = 1040;

/**
 * Facility links as dashed lines: PDU -> row header (power) and cooling unit -> hot aisle top, each labelled
 * with the computed kW. Several links into one target land side by side and their labels stack upward.
 */
export function FeedLines({ layout, plan, loads, highlight }: {
  layout: DcLayout; plan: FloorPlan; loads: FacilityLoads; highlight?: (facilityId: string, targetId: string) => boolean;
}) {
  const { rotation } = useLabels();
  const links: { f: Facility; target: string; rect: Rect; top: number }[] = [];
  for (const f of layout.facilities) {
    for (const id of f.kind === 'pdu' ? f.rowIds ?? [] : f.kind === 'cooling' ? f.aisleIds ?? [] : []) {
      const rect = plan.rects.get(id);
      if (rect) links.push({ f, target: id, rect, top: f.kind === 'pdu' ? rect.y - HEADER_H : rect.y });
    }
  }
  return (
    <g pointerEvents="none">
      {links.map((x) => {
        const { f, rect, top: ty } = x;
        const into = links.filter((y) => y.target === x.target);
        const k = into.indexOf(x);
        const tx = rect.x + (rect.widthMm * (k + 1)) / (into.length + 1);
        // Leave the facility from the side facing the target.
        const sy = f.y + f.depthMm < ty ? f.y + f.depthMm : f.y;
        const sx = Math.min(f.x + f.widthMm - 100, Math.max(f.x + 100, tx));
        const hot = highlight?.(f.id, x.target);
        const my = (sy + ty) / 2;
        const ly = ty - 420 - k * 300;
        const kw = loads.facility.get(f.id)?.shares.find((s) => s.id === x.target)?.kw ?? 0;
        const color = f.kind === 'pdu' ? paint.ink : FACILITY_COLORS.cooling;
        const name = f.kind === 'pdu' ? layout.rows.find((r) => r.id === x.target)?.name : 'hot aisle';
        return (
          <g key={`${f.id}:${x.target}`}>
            <path d={`M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`} fill="none" stroke={color} strokeWidth={hot ? 70 : 40}
              strokeOpacity={hot ? 0.9 : 0.55} strokeDasharray="160 90" />
            <circle cx={tx} cy={ty} r={70} fill={color} />
            <g transform={`translate(${tx} ${ly})${rotation ? ` rotate(${-rotation})` : ''}`}>
              <rect x={-360} y={-125} width={720} height={210} rx={60} fill={paint.paper} stroke={color} strokeWidth={hot ? 40 : 20} />
              <text y={30} fontSize={150} fontWeight={700} textAnchor="middle" fill={color}>{`${kw.toFixed(1)} kW`}</text>
            </g>
            <title>{`${f.name} → ${name}: ${kw.toFixed(1)} kW (computed)`}</title>
          </g>
        );
      })}
    </g>
  );
}
