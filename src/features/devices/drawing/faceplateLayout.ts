import type { DeviceDefinition, PortFace, PortGroup } from '../../../domain/device/types';
import { formatPortRef, groupsOnFace } from '../../../domain/device/ports';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PortBox extends Box {
  ref: string;
  group: PortGroup;
  index: number;
}

export interface GroupLabel {
  group: PortGroup;
  x: number;
  y: number;
}

export interface FaceLayout {
  face: PortFace;
  width: number;
  height: number;
  ports: PortBox[];
  labels: GroupLabel[];
  psus: Box[];
}

export const PORT = { w: 34, h: 30, gap: 4, groupGap: 18, pad: 10, label: 12 };
export const PSU = { w: 46, h: 34, gap: 6 };
const MIN_WIDTH = 160;

function portSize(g: PortGroup) {
  return g.role === 'data' || g.role === 'service' ? { w: PORT.w, h: PORT.h } : { w: 30, h: 22 };
}

/** Lays out port groups left to right; each group fills column-major over `rows` rows. */
function layoutPorts(device: DeviceDefinition, face: PortFace, x0: number) {
  const ports: PortBox[] = [];
  const labels: GroupLabel[] = [];
  let x = x0;
  let bottom = 0;
  for (const g of groupsOnFace(device, face)) {
    const rows = Math.max(1, g.rows);
    const cols = Math.ceil(g.count / rows);
    const { w, h } = portSize(g);
    const y0 = PORT.pad + PORT.label;
    labels.push({ group: g, x, y: y0 - 3 });
    for (let i = 0; i < g.count; i++) {
      const box = { x: x + Math.floor(i / rows) * (w + PORT.gap), y: y0 + (i % rows) * (h + PORT.gap), w, h };
      ports.push({ ...box, ref: formatPortRef({ groupId: g.id, index: i + 1 }), group: g, index: i + 1 });
      bottom = Math.max(bottom, box.y + h);
    }
    const labelW = g.label.length * 6;
    x += Math.max(cols * (w + PORT.gap) - PORT.gap, labelW) + PORT.groupGap;
  }
  return { ports, labels, right: x - PORT.groupGap, bottom };
}

/** PSUs split evenly between left and right edges of the rear face. */
function psuSlots(device: DeviceDefinition, face: PortFace) {
  const count = face === 'rear' ? device.psus?.count ?? 0 : 0;
  const left = Math.ceil(count / 2);
  return { left, right: count - left };
}

/**
 * Layout of one face. Width follows content; `width` lets both faces share the widest width
 * (right-side PSUs then align to the shared right edge).
 */
export function layoutFace(device: DeviceDefinition, face: PortFace, width?: number): FaceLayout {
  const slots = psuSlots(device, face);
  const psuCol = (n: number) => (n > 0 ? PSU.w + PORT.pad : 0);
  const portsX = PORT.pad + psuCol(slots.left);
  const { ports, labels, right, bottom } = layoutPorts(device, face, portsX);
  const contentRight = Math.max(right, portsX) + PORT.pad + psuCol(slots.right);
  const w = Math.max(width ?? 0, contentRight, MIN_WIDTH);
  const psuRows = Math.max(slots.left, slots.right);
  const h = Math.max(bottom + PORT.pad, psuRows ? PORT.pad * 2 + psuRows * (PSU.h + PSU.gap) - PSU.gap : 0, 48);
  const psus: Box[] = [];
  for (let i = 0; i < slots.left; i++) psus.push({ x: PORT.pad, y: PORT.pad + i * (PSU.h + PSU.gap), w: PSU.w, h: PSU.h });
  for (let i = 0; i < slots.right; i++) psus.push({ x: w - PORT.pad - PSU.w, y: PORT.pad + i * (PSU.h + PSU.gap), w: PSU.w, h: PSU.h });
  return { face, width: w, height: h, ports, labels, psus };
}
