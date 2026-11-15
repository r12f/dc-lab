import { memo } from 'react';
import type { RoutedLink } from './cable-routes';
import type { Library } from '../../domain/library/library';
import type { RackDesign } from '../../domain/design/types';
import { paint } from '../../theme/paint';

interface Props {
  lib: Library;
  design: RackDesign;
  routes: RoutedLink[];
  /** Selected cable run: the link carrying it is highlighted. */
  selectedId?: string;
  /** Run ids with problems; a link with any is drawn with a red casing. */
  errorIds?: Set<string>;
  onSelect(id: string): void;
}

/** All polylines of a link as one path (`M … L … M …`). */
function linkPath(paths: [number, number][][]): string {
  return paths.map((pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('')).join('');
}

/** End dots of a link as one path of small circles. */
function dotsPath(ends: [number, number][], r = 2.2): string {
  return ends.map(([x, y]) => `M${x - r},${y}a${r},${r} 0 1 0 ${2 * r},0a${r},${r} 0 1 0 ${-2 * r},0`).join('');
}

/**
 * Links over the elevation: one line per set of devices joined, however many cables it carries (count and media
 * in the tooltip). Colour = the cables' media colour when they share one, else neutral. Casings, lines and hit
 * targets are separate layers so no link's casing hides another's line; the selected link is drawn on top.
 * Only a selected or faulty link gets a casing; while one is selected the others are a faint neutral.
 */
export const CableRoutesDrawing = memo(function CableRoutesDrawing({ lib, design, routes, selectedId, errorIds, onSelect }: Props) {
  const label = (id: string) => design.placements.find((p) => p.id === id)?.label ?? id;
  const items = routes.map(({ link, paths }) => {
    const medias = [...new Set(link.runs.map((r) => r.mediaId))];
    const cables = link.runs.reduce((n, r) => n + r.quantity, 0);
    const mediaText = medias.map((m) => {
      const n = link.runs.filter((r) => r.mediaId === m).reduce((k, r) => k + r.quantity, 0);
      return `${n}× ${lib.cableMedia.get(m)?.name ?? m}`;
    }).join(', ');
    return {
      link,
      sel: !!selectedId && link.runs.some((r) => r.id === selectedId),
      bad: link.runs.some((r) => errorIds?.has(r.id)),
      color: medias.length === 1 ? lib.cableMedia.get(medias[0])?.color ?? paint.ink : paint.ink,
      d: linkPath(paths),
      dots: dotsPath(paths.slice(1).map((pts) => pts[0])),
      title: `${link.placementIds.map(label).join(' ↔ ')} · ${cables} cable${cables > 1 ? 's' : ''} · ${link.route} side\n${mediaText}`,
    };
  }).sort((a, b) => Number(a.sel) - Number(b.sel)); // SVG has no z-index: selected last.
  const anySel = items.some((i) => i.sel);
  const dim = (i: { sel: boolean }) => anySel && !i.sel;
  return (
    <g>
      <g pointerEvents="none">
        {items.filter((i) => i.sel || i.bad).map((i) => (
          <path key={i.link.key} d={i.d} fill="none" stroke={i.sel ? paint.selection : paint.danger}
            strokeWidth={i.sel ? 5 : 3} strokeLinejoin="round" strokeOpacity={dim(i) ? 0.25 : 1} />
        ))}
      </g>
      <g pointerEvents="none">
        {items.map((i) => (
          <path key={i.link.key} d={i.d} fill="none" stroke={dim(i) ? paint.inkMuted : i.color} strokeLinejoin="round"
            strokeWidth={i.sel ? 2.5 : 1.25} strokeOpacity={dim(i) ? 0.12 : 1} />
        ))}
        {items.map((i) => (
          <path key={`e${i.link.key}`} d={i.dots} fill={dim(i) ? paint.inkMuted : i.color} opacity={dim(i) ? 0.12 : 1}
            stroke={dim(i) ? 'none' : paint.ink} strokeWidth={0.4} />
        ))}
      </g>
      {/* Hit targets on top; clicking a link opens its first cable run. */}
      <g style={{ cursor: 'pointer' }}>
        {items.map((i) => (
          <path key={i.link.key} d={i.d} fill="none" stroke="transparent" strokeWidth={4}
            onPointerDown={(e) => { e.stopPropagation(); onSelect(i.link.runs[0].id); }}>
            <title>{i.title}</title>
          </path>
        ))}
      </g>
    </g>
  );
});
