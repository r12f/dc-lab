import type { ReactNode } from 'react';
import type { RackTemplate } from '../domain/rack/types';
import type { SideName } from '../domain/design/types';
import { bodyX, sideSlotRect, unitTopY, type RackGeometry } from './rackGeometry';
import { paint } from '../theme/paint';

interface Props {
  rack: RackTemplate;
  geo: RackGeometry;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  onSideSlotClick?(side: SideName, slot: number): void;
}

/** Empty rack elevation: rails with unit numbers, body, and side pods. */
export function RackFrame({ rack, geo, title, subtitle, children, onSideSlotClick }: Props) {
  const units = Array.from({ length: rack.units }, (_, i) => i + 1);
  const bx = bodyX(geo);
  const bodyH = rack.units * geo.unitPx;
  const sides: SideName[] = ['left', 'right'];
  return (
    <g>
      <text x={0} y={14} fontSize={14} fontWeight={700} fill={paint.ink}>{title}</text>
      {subtitle && <text x={0} y={30} fontSize={10} fill={paint.inkMuted}>{subtitle}</text>}
      <rect x={geo.originX} y={geo.originY - 4} width={geo.railW * 2 + geo.bodyW} height={bodyH + 8} fill={paint.frame} rx={3} />
      <rect x={bx} y={geo.originY} width={geo.bodyW} height={bodyH} fill={paint.slot} />
      {units.map((u) => {
        const y = unitTopY(geo, rack, u);
        return (
          <g key={u}>
            <line x1={bx} x2={bx + geo.bodyW} y1={y} y2={y} stroke={paint.grid} strokeWidth={0.5} />
            <text x={geo.originX + geo.railW - 4} y={y + geo.unitPx - 5} fontSize={8} textAnchor="end" fill={paint.frameText}>{u}</text>
            <text x={bx + geo.bodyW + 4} y={y + geo.unitPx - 5} fontSize={8} fill={paint.frameText}>{u}</text>
          </g>
        );
      })}
      {sides.flatMap((side) =>
        Array.from({ length: rack.sidePods[side] }, (_, i) => {
          const r = sideSlotRect(geo, side, i + 1);
          return (
            <rect key={`${side}-${i}`} x={r.x} y={r.y + 1} width={r.w} height={r.h - 2} rx={3}
              fill={paint.slot} stroke={paint.inkMuted} strokeDasharray="3 2"
              onClick={() => onSideSlotClick?.(side, i + 1)} />
          );
        }),
      )}
      {children}
      <text x={geo.width / 2} y={geo.originY + bodyH + 22} fontSize={10} textAnchor="middle" fill={paint.inkMuted}>
        {`${rack.units}${rack.unitSystem} · ${rack.widthMm}x${rack.depthMm}x${rack.heightMm} mm`}
      </text>
    </g>
  );
}
