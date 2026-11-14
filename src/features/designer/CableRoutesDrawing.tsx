import type { RoutedCable } from './cableRoutes';
import type { Library } from '../../domain/library/Library';
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
      {ordered.map(({ run, points }) => {
        const media = lib.cableMedia.get(run.mediaId);
        const sel = run.id === selectedId;
        const d = points.map(([x, y]) => `${x},${y}`).join(' ');
        return (
          <g key={run.id} style={{ cursor: 'pointer' }} onPointerDown={(e) => { e.stopPropagation(); onSelect(run.id); }}>
            <title>{`${media?.name ?? run.mediaId} ×${run.quantity} · ${run.route} side`}</title>
            {/* Wide transparent stroke = easier hit target. */}
            <polyline points={d} fill="none" stroke="transparent" strokeWidth={8} />
            {/* Casing keeps any media color visible on the dark rail and on device fills. */}
            <polyline points={d} fill="none" stroke={sel ? paint.selection : '#0f172a'} strokeWidth={sel ? 6 : 4.5} strokeLinejoin="round" pointerEvents="none" />
            <polyline points={d} fill="none" stroke={media?.color ?? paint.ink} strokeWidth={2.5} strokeLinejoin="round" pointerEvents="none" />
            {[points[0], points[points.length - 1]].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={3.5} fill={media?.color ?? paint.ink} stroke={paint.ink} strokeWidth={0.5} pointerEvents="none" />
            ))}
          </g>
        );
      })}
    </g>
  );
}
