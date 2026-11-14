import type { DeviceDefinition, PortFace, PortGroup } from '../../domain/device/types';
import { formatPortRef, groupsOnFace } from '../../domain/device/ports';

export interface PortBox {
  ref: string;
  group: PortGroup;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FaceLayout {
  face: PortFace;
  width: number;
  height: number;
  ports: PortBox[];
}

export const PORT = { w: 22, h: 16, gap: 4, groupGap: 16, pad: 12 };

/**
 * Lays out port cages: each group is a block of `rows` rows, filled column-major
 * (odd ports top, even ports bottom for 2 rows) like a switch faceplate.
 */
export function layoutFace(device: DeviceDefinition, face: PortFace, minWidth: number): FaceLayout {
  const ports: PortBox[] = [];
  let x = PORT.pad;
  let maxRows = 1;
  for (const g of groupsOnFace(device, face)) {
    const rows = Math.max(1, g.rows);
    const cols = Math.ceil(g.count / rows);
    maxRows = Math.max(maxRows, rows);
    for (let i = 0; i < g.count; i++) {
      const col = Math.floor(i / rows);
      const row = i % rows;
      ports.push({
        ref: formatPortRef({ groupId: g.id, index: i + 1 }),
        group: g, index: i + 1,
        x: x + col * (PORT.w + PORT.gap),
        y: PORT.pad + 14 + row * (PORT.h + PORT.gap),
        w: PORT.w, h: PORT.h,
      });
    }
    x += cols * (PORT.w + PORT.gap) + PORT.groupGap;
  }
  const height = PORT.pad * 2 + 14 + maxRows * (PORT.h + PORT.gap);
  return { face, width: Math.max(minWidth, x + PORT.pad), height, ports };
}
