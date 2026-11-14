import type { Ref } from 'react';
import type { RackTemplate } from '../../domain/rack/types';
import { RACK_KINDS } from '../../domain/rack/types';
import { RackFrame } from '../../drawing/rack-frame';
import { rackGeometry } from '../../drawing/rack-geometry';
import { FootprintDrawing } from './footprint-drawing';
import { formatPower } from '../../domain/units';
import { paint } from '../../theme/paint';

/** Front elevation + top-down footprint of a rack template. */
interface Props {
  rack: RackTemplate;
  ref?: Ref<SVGSVGElement>;
  selectedElementId?: string;
  onElementClick?(id: string): void;
}

export function RackTemplateDrawing({ rack, ref, selectedElementId, onElementClick }: Props) {
  const geo = rackGeometry(rack);
  const footX = geo.width + 60;
  const w = footX + 360;
  const h = Math.max(geo.height, 360);
  return (
    <svg ref={ref} viewBox={`-10 -10 ${w + 20} ${h + 20}`} width={w + 20} className="drawing">
      <rect x={-10} y={-10} width={w + 20} height={h + 20} fill={paint.paper} />
      <RackFrame rack={rack} geo={geo} title={rack.name} selectedElementId={selectedElementId} onElementClick={onElementClick}
        subtitle={`${RACK_KINDS[rack.kind]} · ${formatPower(rack.maxPowerW)} · ${rack.maxLoadKg} kg load`} />
      <g transform={`translate(${footX} 40)`}>
        <FootprintDrawing rack={rack} />
      </g>
    </svg>
  );
}
