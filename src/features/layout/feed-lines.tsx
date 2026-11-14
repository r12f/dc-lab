import type { DcLayout } from '../../domain/layout/types';
import type { FloorPlan } from '../../domain/layout/floor-plan';
import { paint } from '../../theme/paint';
import { useLabels } from './view-context';

/** Height of the row header box above the tiles (must match row-drawing). */
const HEADER_H = 1040;

/**
 * PDU -> row power feeds as lines from the PDU's edge to the top of the row header, labelled with kW.
 * Several feeds into one row land side by side on the header so they don't overlap.
 */
export function FeedLines({ layout, plan, highlight }: { layout: DcLayout; plan: FloorPlan; highlight?: (facilityId: string, rowId: string) => boolean }) {
  const { rotation } = useLabels();
  return (
    <g pointerEvents="none">
      {layout.feeds.map((f) => {
        const pdu = layout.facilities.find((x) => x.id === f.facilityId);
        const row = plan.rects.get(f.rowId);
        if (!pdu || !row) return null;
        const into = layout.feeds.filter((x) => x.rowId === f.rowId);
        const k = into.indexOf(f);
        const tx = row.x + (row.widthMm * (k + 1)) / (into.length + 1);
        const ty = row.y - HEADER_H;
        // Leave the PDU from the side facing the row header.
        const sy = pdu.y + pdu.depthMm < ty ? pdu.y + pdu.depthMm : pdu.y;
        const sx = Math.min(pdu.x + pdu.widthMm - 100, Math.max(pdu.x + 100, tx));
        const hot = highlight?.(f.facilityId, f.rowId);
        const my = (sy + ty) / 2;
        // kW label sits on the line just above the row header; feeds into one row stack upward so labels never collide.
        // Clear of the header in every view rotation (the label box is ≤ 660 mm wide on screen).
        const ly = ty - 420 - k * 300;
        return (
          <g key={f.id}>
            <path d={`M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`} fill="none" stroke={paint.ink} strokeWidth={hot ? 70 : 40}
              strokeOpacity={hot ? 0.9 : 0.55} strokeDasharray="160 90" />
            <circle cx={tx} cy={ty} r={70} fill={paint.ink} />
            <g transform={`translate(${tx} ${ly})${rotation ? ` rotate(${-rotation})` : ''}`}>
              <rect x={-330} y={-125} width={660} height={210} rx={60} fill={paint.paper} stroke={paint.ink} strokeWidth={hot ? 40 : 20} />
              <text y={30} fontSize={150} fontWeight={700} textAnchor="middle" fill={paint.ink}>{`${f.kw} kW`}</text>
            </g>
            <title>{`${pdu.name} → ${layout.rows.find((r) => r.id === f.rowId)?.name}: ${f.kw} kW`}</title>
          </g>
        );
      })}
    </g>
  );
}
