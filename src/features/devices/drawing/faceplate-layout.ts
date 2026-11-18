import type { DeviceDefinition, PortFace, PortGroup } from '../../../domain/device/types';
import { drawOrder, faceRows, formatPortRef, groupCols, groupsOnFace, portCell } from '../../../domain/device/ports';
import { groupTitle } from './group-title';

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

/** Faceplate metrics in SVG units. Ports are sized so index, speed and reach stay legible at 100% zoom. */
export const PORT = { w: 66, h: 64, gap: 5, groupGap: 26, pad: 14, label: 20, labelFont: 12 };
export const SMALL_PORT = { w: 50, h: 34 };
export const PSU = { w: 76, h: 54, gap: 8 };
const MIN_WIDTH = 240;
/** Approximate glyph width of the group label font, used to reserve label space. */
const LABEL_CHAR_W = PORT.labelFont * 0.62;

function portSize(g: PortGroup) {
  return g.role === 'data' || g.role === 'service' ? { w: PORT.w, h: PORT.h } : SMALL_PORT;
}

/**
 * Lays out port groups left to right; each group fills column-major over `rows` rows. Groups with a higher
 * `faceRow` start a new line under the previous one.
 */
function layoutPorts(device: DeviceDefinition, face: PortFace, x0: number) {
  const ports: PortBox[] = [];
  const labels: GroupLabel[] = [];
  let right = x0;
  let bottom = 0;
  let lineTop = PORT.pad;
  // A mirrored face (rear of a pass-through panel, seen from behind) also runs its groups right to left.
  for (const line of faceRows(drawOrder(groupsOnFace(device, face)))) {
    let x = x0;
    const y0 = lineTop + PORT.label;
    for (const g of line) {
      const rows = Math.max(1, g.rows);
      const cols = groupCols(g, rows);
      const { w, h } = portSize(g);
      labels.push({ group: g, x, y: y0 - 6 });
      for (let i = 0; i < g.count; i++) {
        const { col, row } = portCell(g, i, rows);
        const box = { x: x + col * (w + PORT.gap), y: y0 + row * (h + PORT.gap), w, h };
        ports.push({ ...box, ref: formatPortRef({ groupId: g.id, index: i + 1 }), group: g, index: i + 1 });
        bottom = Math.max(bottom, box.y + h);
      }
      const labelW = groupTitle(g).length * LABEL_CHAR_W;
      x += Math.max(cols * (w + PORT.gap) - PORT.gap, labelW) + PORT.groupGap;
    }
    right = Math.max(right, x);
    lineTop = bottom + PORT.gap;
  }
  return { ports, labels, right: right - PORT.groupGap, bottom };
}

/** PSUs split evenly between left and right edges of the rear face. */
function psuSlots(device: DeviceDefinition, face: PortFace) {
  const count = face === 'rear' ? device.psus?.count ?? 0 : 0;
  if (device.psus?.layout === 'row') return { left: 0, right: 0, row: count };
  const left = Math.ceil(count / 2);
  return { left, right: count - left, row: 0 };
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
  const rowW = slots.row ? PORT.pad * 2 + slots.row * (PSU.w + PSU.gap) - PSU.gap : 0;
  const contentRight = Math.max(Math.max(right, portsX) + PORT.pad + psuCol(slots.right), rowW);
  const w = Math.max(width ?? 0, contentRight, MIN_WIDTH);
  const psuRows = Math.max(slots.left, slots.right);
  // A PSU row sits under the ports.
  const rowY = slots.row && bottom ? bottom + PORT.gap : PORT.pad;
  const h = Math.max(bottom + PORT.pad, psuRows ? PORT.pad * 2 + psuRows * (PSU.h + PSU.gap) - PSU.gap : 0,
    slots.row ? rowY + PSU.h + PORT.pad : 0, 72);
  const psus: Box[] = [];
  for (let i = 0; i < slots.left; i++) psus.push({ x: PORT.pad, y: PORT.pad + i * (PSU.h + PSU.gap), w: PSU.w, h: PSU.h });
  for (let i = 0; i < slots.right; i++) psus.push({ x: w - PORT.pad - PSU.w, y: PORT.pad + i * (PSU.h + PSU.gap), w: PSU.w, h: PSU.h });
  for (let i = 0; i < slots.row; i++) psus.push({ x: PORT.pad + i * (PSU.w + PSU.gap), y: rowY, w: PSU.w, h: PSU.h });
  return { face, width: w, height: h, ports, labels, psus };
}
