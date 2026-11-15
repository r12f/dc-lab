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
 * target, casing, line, end dots), so racks with hundreds of runs stay fast to draw. Casings, lines and hit
 * targets are separate layers so no run's casing hides another run's line.
 */
export const CableRoutesDrawing = memo(function CableRoutesDrawing({ lib, routes, selectedId, errorIds, onSelect }: Props) {
  // SVG has no z-index: draw the selected run last.
  const ordered = [...routes].sort((a, b) => Number(a.run.id === selectedId) - Number(b.run.id === selectedId));
  const runs = ordered.map(({ run, paths }) => {
    const media = lib.cableMedia.get(run.mediaId);
    return {
      run, media, d: runPath(paths), dots: dotsPath(paths.slice(1).map((pts) => pts[0])),
      sel: run.id === selectedId, bad: !!errorIds?.has(run.id), color: media?.color ?? paint.ink,
    };
  });
  // Layers, not per run: every casing first, then every coloured line. Drawn per run, each run's dark casing
  // covered the runs drawn before it wherever its stubs cross their spines, so lines looked broken.
  // The selected run is drawn last in every layer (on top).
  return (
    <g>
      <g pointerEvents="none">
        {runs.map((r) => (
          <path key={r.run.id} d={r.d} fill="none" stroke={r.sel ? paint.selection : r.bad ? paint.danger : '#0f172a'}
            strokeWidth={r.sel || r.bad ? 6 : 4.5} strokeLinejoin="round" />
        ))}
      </g>
      <g pointerEvents="none">
        {runs.map((r) => <path key={r.run.id} d={r.d} fill="none" stroke={r.color} strokeWidth={2.5} strokeLinejoin="round" />)}
        {runs.map((r) => <path key={`e${r.run.id}`} d={r.dots} fill={r.color} stroke={paint.ink} strokeWidth={0.5} />)}
      </g>
      {/* Hit targets on top: wide transparent strokes, one per run. */}
      <g style={{ cursor: 'pointer' }}>
        {runs.map((r) => (
          <path key={r.run.id} d={r.d} fill="none" stroke="transparent" strokeWidth={8}
            onPointerDown={(e) => { e.stopPropagation(); onSelect(r.run.id); }}>
            <title>{`${r.media?.name ?? r.run.mediaId} ×${r.run.quantity} · ${r.run.route} side · ${r.run.from.length} A / ${r.run.to.length} B`}</title>
          </path>
        ))}
      </g>
    </g>
  );
});
