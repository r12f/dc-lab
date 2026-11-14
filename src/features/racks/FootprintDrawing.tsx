import type { RackTemplate } from '../../domain/rack/types';
import { elementsOn, overallWidthMm, SIDE_KINDS } from '../../domain/rack/sideElements';
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
  const left = [...elementsOn(rack.sideElements, 'left')].reverse(); // outermost first
  const right = elementsOn(rack.sideElements, 'right');
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
  return (
    <g>
      <text x={0} y={-10} fontSize={11} fontWeight={600} fill={paint.ink}>{`Footprint ${wide}x${deep} tiles (top view)`}</text>
      {Array.from({ length: wide * deep }, (_, i) => (
        <rect key={i} x={(i % wide) * TILE_PX} y={Math.floor(i / wide) * TILE_PX} width={TILE_PX} height={TILE_PX}
          fill={paint.slot} stroke={paint.grid} />
      ))}
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
