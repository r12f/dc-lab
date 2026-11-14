import type { RackTemplate } from '../../domain/rack/types';
import { elementsOn, isInternal, overallWidthMm, SIDE_KINDS } from '../../domain/rack/side-elements';
import { paint } from '../../theme/paint';

const TILE_PX = 60;
const TILE_MM = 600;

/**
 * Top-down view drawn to scale over floor tiles: side elements and rack body side by side,
 * starting at the left edge of the first tile.
 */
export function FootprintDrawing({ rack }: { rack: RackTemplate }) {
  const { wide, deep } = rack.footprintTiles;
  const s = TILE_PX / TILE_MM;
  // Internal elements (PDU bays) sit inside the enclosure: drawn over the body edge, no extra width.
  const outside = rack.sideElements.filter((e) => !isInternal(e));
  const left = [...elementsOn(outside, 'left')].reverse(); // outermost first
  const right = elementsOn(outside, 'right');
  const overall = overallWidthMm(rack.widthMm, rack.sideElements);
  const tilesW = wide * TILE_MM;
  let x = 0;
  const boxes = [
    ...left.map((e) => ({ key: e.id, w: e.widthMm, d: e.depthMm, label: e.name, kind: e.kind as string })),
    { key: 'body', w: rack.widthMm, d: rack.depthMm, label: 'Rack', kind: 'body' },
    ...right.map((e) => ({ key: e.id, w: e.widthMm, d: e.depthMm, label: e.name, kind: e.kind as string })),
  ].map((b) => {
    const out = { ...b, x };
    x += b.w;
    return out;
  });
  const bodyX = boxes.find((b) => b.kind === 'body')!.x;
  for (const side of ['left', 'right'] as const) {
    let edge = side === 'left' ? bodyX : bodyX + rack.widthMm;
    for (const e of elementsOn(rack.sideElements, side).filter(isInternal)) {
      const x = side === 'left' ? edge : edge - e.widthMm;
      boxes.push({ key: e.id, w: e.widthMm, d: e.depthMm, label: `${e.name} (inside rack)`, kind: e.kind, x });
      edge = side === 'left' ? edge + e.widthMm : edge - e.widthMm;
    }
  }
  return (
    <g>
      <text x={0} y={-10} fontSize={11} fontWeight={600} fill={paint.ink}>{`Footprint ${wide}x${deep} tiles (top view)${Number.isInteger(wide) ? '' : ' · dashed line = row pitch'}`}</text>
      {Array.from({ length: Math.ceil(wide) * deep }, (_, i) => (
        <rect key={i} x={(i % Math.ceil(wide)) * TILE_PX} y={Math.floor(i / Math.ceil(wide)) * TILE_PX} width={TILE_PX} height={TILE_PX}
          fill={paint.slot} stroke={paint.grid} />
      ))}
      {/* Row pitch the rack takes (e.g. 1.5 tiles for ORv3): the next rack in the row starts here. */}
      <line x1={wide * TILE_PX} x2={wide * TILE_PX} y1={-4} y2={deep * TILE_PX + 4} stroke={paint.ink} strokeDasharray="3 3" />
      {boxes.map((b) => {
        const body = b.kind === 'body';
        const dashed = !body && SIDE_KINDS[b.kind as keyof typeof SIDE_KINDS].dashed;
        return (
          <g key={b.key}>
            <title>{`${b.label} ${b.w}x${b.d} mm`}</title>
            <rect x={b.x * s} y={0} width={b.w * s} height={b.d * s}
              fill={body ? paint.accent : 'none'} fillOpacity={0.25}
              stroke={body ? paint.accent : paint.inkMuted} strokeWidth={body ? 2 : 1.5} strokeDasharray={dashed ? '4 3' : undefined} />
          </g>
        );
      })}
      <text x={0} y={deep * TILE_PX + 16} fontSize={10} fill={paint.inkMuted}>
        {`Front ↓ · tile 600x600 mm · overall width ${overall} mm`}
      </text>
      {overall > tilesW && (
        <text x={0} y={deep * TILE_PX + 30} fontSize={10} fill={paint.danger}>
          {`Exceeds ${wide} tile(s) (${tilesW} mm) — increase tiles wide`}
        </text>
      )}
    </g>
  );
}
