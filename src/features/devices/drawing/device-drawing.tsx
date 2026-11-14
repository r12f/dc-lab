import type { Ref } from 'react';
import type { DeviceDefinition } from '../../../domain/device/types';
import { traitsOf } from '../../../domain/device/categories';
import { formatHeight, formatPower } from '../../../domain/units';
import { drawingStrategyFor } from './drawing-strategy';
import type { DrawingContext } from './types';
import { paint } from '../../../theme/paint';

interface Props {
  ref?: Ref<SVGSVGElement>;
  device: DeviceDefinition;
  ctx: DrawingContext;
  /** Hide the title block (compact previews). */
  compact?: boolean;
}

/** Standalone SVG of a device: title block + the strategy-specific drawing. */
export function DeviceDrawing({ ref, device, ctx, compact }: Props) {
  const strategy = drawingStrategyFor(device);
  const size = strategy.size(device);
  const header = compact ? 0 : 56;
  const titleW = compact ? 0 : 760;
  const width = Math.max(size.width, titleW) + 20;
  const height = header + size.height + 20;
  const psu = device.psus ? ` · ${device.psus.count}x PSU ${device.psus.inlet}` : '';
  return (
    <svg ref={ref} viewBox={`-10 -10 ${width} ${height}`} width={width} className="drawing">
      <rect x={-10} y={-10} width={width} height={height} fill={paint.paper} />
      {!compact && (
        <>
          <text x={0} y={10} fontSize={20} fontWeight={700} fill={paint.ink}>{device.name}</text>
          <text x={0} y={32} fontSize={13} fill={paint.inkMuted}>
            {`${device.vendor} ${device.model} · ${traitsOf(device.category).label} · ${formatHeight(device.height)} · ` +
              `${formatPower(device.power.typicalW)} typ / ${formatPower(device.power.maxW)} max · ${device.weightKg} kg${psu}`}
          </text>
        </>
      )}
      <g transform={`translate(0 ${header})`}>
        <strategy.Component device={device} ctx={ctx} />
      </g>
    </svg>
  );
}
