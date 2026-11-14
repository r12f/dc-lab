import type { RackTemplate } from '../../domain/rack/types';
import { paint } from '../../theme/paint';

const TILE_PX = 60;

/** Top-down view: footprint tiles with the rack outline drawn to scale (tile = 600 mm). */
export function FootprintDrawing({ rack }: { rack: RackTemplate }) {
  const { wide, deep } = rack.footprintTiles;
  const scale = TILE_PX / 600;
  return (
    <g>
      <text x={0} y={-10} fontSize={11} fontWeight={600} fill={paint.ink}>{`Footprint ${wide}x${deep} tiles (top view)`}</text>
      {Array.from({ length: wide * deep }, (_, i) => (
        <rect key={i} x={(i % wide) * TILE_PX} y={Math.floor(i / wide) * TILE_PX} width={TILE_PX} height={TILE_PX}
          fill={paint.slot} stroke={paint.grid} />
      ))}
      <rect x={0} y={0} width={rack.widthMm * scale} height={rack.depthMm * scale} fill={paint.accent} fillOpacity={0.25}
        stroke={paint.accent} strokeWidth={2} />
      <text x={0} y={deep * TILE_PX + 16} fontSize={10} fill={paint.inkMuted}>Front ↓ · tile 600x600 mm</text>
    </g>
  );
}
