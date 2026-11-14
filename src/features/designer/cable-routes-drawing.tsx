import type { RoutedCable } from './cable-routes';
import type { Library } from '../../domain/library/library';
import { paint } from '../../theme/paint';

interface Props {
  lib: Library;
  routes: RoutedCable[];
  selectedId?: string;
  onSelect(id: string): void;
}

/** In-rack cable runs drawn over the elevation; selected run on top and highlighted. */
export function CableRoutesDrawing({ lib, routes, selectedId, onSelect }: Props) {
  // SVG has no z-index: draw the selected run last.
  const ordered = [...routes].sort((a, b) => Number(a.run.id === selectedId) - Number(b.run.id === selectedId));
  return (
    <g>
      {ordered.map(({ run, paths }) => {
        const media = lib.cableMedia.get(run.mediaId);
        const sel = run.id === selectedId;
        const color = media?.color ?? paint.ink;
        const ds = paths.map((pts) => pts.map(([x, y]) => `${x},${y}`).join(' '));
        const ends = paths.slice(1).map((pts) => pts[0]);
        return (
          <g key={run.id} style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.stopPropagation(); onSelect(run.id); }}>
            <title>{`${media?.name ?? run.mediaId} ×${run.quantity} · ${run.route} side · ${run.from.length} A / ${run.to.length} B`}</title>
            {/* Wide transparent stroke = easier hit target. */}
            {ds.map((d, i) => <polyline key={`h${i}`} points={d} fill="none" stroke="transparent" strokeWidth={8} />)}
            {/* Casing keeps any media color visible on the dark rail and on device fills. */}
            {ds.map((d, i) => <polyline key={`c${i}`} points={d} fill="none" stroke={sel ? paint.selection : '#0f172a'} strokeWidth={sel ? 6 : 4.5} strokeLinejoin="round" pointerEvents="none" />)}
            {ds.map((d, i) => <polyline key={`l${i}`} points={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" pointerEvents="none" />)}
            {ends.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={3.5} fill={color} stroke={paint.ink} strokeWidth={0.5} pointerEvents="none" />
            ))}
          </g>
        );
      })}
    </g>
  );
}
