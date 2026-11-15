import { memo } from 'react';
import type { RoutedCable } from './cable-routes';
import type { Library } from '../../domain/library/library';
import { paint } from '../../theme/paint';

interface Props {
  lib: Library;
  routes: RoutedCable[];
  selectedId?: string;
  /** Run ids with problems; drawn with a red casing. */
  errorIds?: Set<string>;
  onSelect(id: string): void;
}

/** All polylines of a run as one path (`M … L … M …`), so a run is a handful of elements however many ends it has. */
function runPath(paths: [number, number][][]): string {
  return paths.map((pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('')).join('');
}

/** End dots of a run as one path of small circles. */
function dotsPath(ends: [number, number][], r = 3.5): string {
  return ends.map(([x, y]) => `M${x - r},${y}a${r},${r} 0 1 0 ${2 * r},0a${r},${r} 0 1 0 ${-2 * r},0`).join('');
}

/**
 * In-rack cable runs drawn over the elevation; selected run on top and highlighted. Each run is four paths (hit
 * target, casing, line, end dots), so racks with hundreds of runs stay fast to draw.
 */
export const CableRoutesDrawing = memo(function CableRoutesDrawing({ lib, routes, selectedId, errorIds, onSelect }: Props) {
  // SVG has no z-index: draw the selected run last.
  const ordered = [...routes].sort((a, b) => Number(a.run.id === selectedId) - Number(b.run.id === selectedId));
  return (
    <g>
      {ordered.map(({ run, paths }) => {
        const media = lib.cableMedia.get(run.mediaId);
        const sel = run.id === selectedId;
        const bad = !!errorIds?.has(run.id);
        const color = media?.color ?? paint.ink;
        const d = runPath(paths);
        const ends = paths.slice(1).map((pts) => pts[0]);
        return (
          <g key={run.id} style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.stopPropagation(); onSelect(run.id); }}>
            <title>{`${media?.name ?? run.mediaId} ×${run.quantity} · ${run.route} side · ${run.from.length} A / ${run.to.length} B`}</title>
            {/* Wide transparent stroke = easier hit target. */}
            <path d={d} fill="none" stroke="transparent" strokeWidth={8} />
            {/* Casing keeps any media color visible on the dark rail and on device fills. */}
            <path d={d} fill="none" stroke={sel ? paint.selection : bad ? paint.danger : '#0f172a'}
              strokeWidth={sel || bad ? 6 : 4.5} strokeLinejoin="round" pointerEvents="none" />
            <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" pointerEvents="none" />
            <path d={dotsPath(ends)} fill={color} stroke={paint.ink} strokeWidth={0.5} pointerEvents="none" />
          </g>
        );
      })}
    </g>
  );
});
