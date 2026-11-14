import type { Ref } from 'react';
import type { RackTemplate } from '../../domain/rack/types';
import { RACK_KINDS } from '../../domain/rack/types';
import { RackFrame } from '../../drawing/RackFrame';
import { rackGeometry } from '../../drawing/rackGeometry';
import { FootprintDrawing } from './FootprintDrawing';
import { formatPower } from '../../domain/units';
import { paint } from '../../theme/paint';

/** Front elevation + top-down footprint of a rack template. */
export function RackTemplateDrawing({ rack, ref }: { rack: RackTemplate; ref?: Ref<SVGSVGElement> }) {
  const geo = rackGeometry(rack);
  const footX = geo.width + 60;
  const w = footX + 320;
  const h = Math.max(geo.height, 360);
  return (
    <svg ref={ref} viewBox={`-10 -10 ${w + 20} ${h + 20}`} width={w + 20} className="drawing">
      <rect x={-10} y={-10} width={w + 20} height={h + 20} fill={paint.paper} />
      <RackFrame rack={rack} geo={geo} title={rack.name}
        subtitle={`${RACK_KINDS[rack.kind]} · ${formatPower(rack.maxPowerW)} · ${rack.maxLoadKg} kg load`} />
      <g transform={`translate(${footX} 40)`}>
        <FootprintDrawing rack={rack} />
      </g>
    </svg>
  );
}
