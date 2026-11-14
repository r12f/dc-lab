import { uniqueId } from '../ids';
import { snap } from './geometry';
import type { DcLayout, Door, Wall } from './types';

export const WALLS: Wall[] = ['north', 'east', 'south', 'west'];

/** Length of a wall (mm). */
export function wallLength(l: DcLayout, wall: Wall): number {
  return wall === 'north' || wall === 'south' ? l.room.widthMm : l.room.depthMm;
}

/** Keeps the door on its wall: 0 <= offset <= wall length - width. */
export function clampDoor(l: DcLayout, d: Door): Door {
  const max = Math.max(0, wallLength(l, d.wall) - d.widthMm);
  return { ...d, offsetMm: Math.min(max, Math.max(0, d.offsetMm)) };
}

/**
 * Opening of a door on the room outline, as a segment from (x1,y1) to (x2,y2), plus the inward unit
 * normal (nx, ny) the door swings towards.
 */
export function doorSegment(l: DcLayout, d: Door) {
  const { widthMm: W, depthMm: D } = l.room;
  const a = d.offsetMm;
  const b = d.offsetMm + d.widthMm;
  switch (d.wall) {
    case 'north': return { x1: a, y1: 0, x2: b, y2: 0, nx: 0, ny: 1 };
    case 'south': return { x1: a, y1: D, x2: b, y2: D, nx: 0, ny: -1 };
    case 'west': return { x1: 0, y1: a, x2: 0, y2: b, nx: 1, ny: 0 };
    case 'east': return { x1: W, y1: a, x2: W, y2: b, nx: -1, ny: 0 };
  }
}

/** The wall nearest to (x, y) and the door offset along it that centres a `width` door there. */
export function nearestWallSpot(l: DcLayout, x: number, y: number, width: number): { wall: Wall; offsetMm: number } {
  const { widthMm: W, depthMm: D } = l.room;
  const dist: [Wall, number][] = [['north', Math.abs(y)], ['south', Math.abs(D - y)], ['west', Math.abs(x)], ['east', Math.abs(W - x)]];
  const wall = dist.sort((p, q) => p[1] - q[1])[0][0];
  const along = wall === 'north' || wall === 'south' ? x : y;
  return { wall, offsetMm: snap(along - width / 2) };
}

/** Adds a 1.2 m entry door centred on the south wall, or next to the selected door on the same wall. */
export function addDoor(l: DcLayout, nextTo?: string): { layout: DcLayout; id: string } {
  const id = uniqueId('door', l.doors.map((d) => d.id));
  const ref = l.doors.find((d) => d.id === nextTo);
  const base: Door = ref
    ? { id, name: `Door ${l.doors.length + 1}`, wall: ref.wall, offsetMm: ref.offsetMm + ref.widthMm + 1000, widthMm: ref.widthMm, kind: 'exit' }
    : { id, name: l.doors.length ? `Door ${l.doors.length + 1}` : 'Entry', wall: 'south', offsetMm: snap(l.room.widthMm / 2 - 600), widthMm: 1200, kind: l.doors.length ? 'exit' : 'entry' };
  return { id, layout: { ...l, doors: [...l.doors, clampDoor(l, base)] } };
}
