import type { Mount, SideName } from '../../domain/design/types';
import type { PortFace } from '../../domain/device/types';
import type { RackTemplate } from '../../domain/rack/types';
import { unitAtY, type RackGeometry } from '../../drawing/rackGeometry';

/** Converts an SVG point to a mount: side pod slot if over one, otherwise a rack unit. */
export function mountAt(geo: RackGeometry, rack: RackTemplate, face: PortFace, x: number, y: number): Mount {
  const sides: SideName[] = ['left', 'right'];
  for (const side of sides) {
    const slots = rack.sidePods[side];
    const x0 = side === 'left' ? 4 : geo.width - geo.podW - 4;
    if (slots > 0 && x >= x0 && x <= x0 + geo.podW) {
      const slot = Math.min(slots, Math.max(1, Math.floor((y - geo.originY) / geo.podSlotH) + 1));
      return { kind: 'side', side, slot };
    }
  }
  return { kind: 'rack', position: unitAtY(geo, rack, y), face };
}
