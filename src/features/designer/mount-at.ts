import type { Mount } from '../../domain/design/types';
import type { PortFace } from '../../domain/device/types';
import type { RackTemplate } from '../../domain/rack/types';
import { sideSlotAt, unitAtY, type RackGeometry } from '../../drawing/rack-geometry';

/** Converts an SVG point to a mount: side element slot if over one, otherwise a rack unit. */
export function mountAt(geo: RackGeometry, rack: RackTemplate, face: PortFace, x: number, y: number): Mount {
  const side = sideSlotAt(geo, x, y);
  if (side) return { kind: 'side', ...side };
  return { kind: 'rack', position: unitAtY(geo, rack, y), face };
}
