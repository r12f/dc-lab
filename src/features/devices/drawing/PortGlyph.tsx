import type { PortBox } from './faceplateLayout';
import type { DrawingContext } from './types';
import { idColor, modeColor, ROLE_COLORS, shortMode } from './portStyle';
import { ROLE_TRAITS } from '../../../domain/device/roles';
import { formFactorSpec } from '../../../domain/ports/formFactors';
import { paint } from '../../../theme/paint';

/**
 * One port cage. Data/service ports show index + breakout; a top strip marks the optic and a
 * bottom strip marks the attached cable. Other roles show their role label.
 */
export function PortGlyph({ box, ctx }: { box: PortBox; ctx: DrawingContext }) {
  const r = ctx.resolve(box.ref);
  const pluggable = ROLE_TRAITS[box.group.role].pluggable;
  const fill = pluggable && r ? modeColor(r.mode) : ROLE_COLORS[box.group.role];
  const sel = ctx.selectedPorts.has(box.ref);
  const optic = r?.optic;
  const cable = r?.cableId ? ctx.lib.cableMedia.get(r.cableId) : undefined;
  const fiberPort = formFactorSpec(box.group.formFactor).kind === 'fiber';
  const cx = box.x + box.w / 2;
  const engine = box.group.opticalEngine ? ` · ${box.group.opticalEngine.toUpperCase()}` : '';
  const tip = [
    `${box.ref} · ${box.group.formFactor}${engine} · ${ROLE_TRAITS[box.group.role].label}`,
    pluggable && r ? `Speed ${r.mode}` : '',
    r?.reach ? `Reach ${r.reach}` : '',
    optic ? `Module ${optic.name}${r?.autoOptic ? ' (auto)' : ''}` : '',
    cable ? `Cable ${cable.name}` : '',
  ].filter(Boolean).join('\n');
  const markColor = optic ? idColor(optic.id) : r?.reach ? idColor(r.reach) : undefined;
  return (
    <g style={{ cursor: 'pointer' }} onClick={(e) => ctx.onPortClick?.(box.ref, e.ctrlKey || e.metaKey || e.shiftKey)}>
      <title>{tip}</title>
      {/* Fiber ports (CPO/NPO) are drawn rounded to set them apart from module cages. */}
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={fiberPort ? 8 : 2} fill={fill}
        stroke={sel ? paint.selection : '#0f172a'} strokeWidth={sel ? 2.5 : 1} />
      {markColor && <rect x={box.x + 2} y={box.y + 2} width={box.w - 4} height={3} fill={markColor} pointerEvents="none" />}
      {cable && <rect x={box.x + 2} y={box.y + box.h - 5} width={box.w - 4} height={3} fill={cable.color} pointerEvents="none" />}
      {pluggable ? (
        <>
          <text x={cx} y={box.y + 12} fontSize={8} textAnchor="middle" fill="#fff" fontWeight={700} pointerEvents="none">{box.index}</text>
          <text x={cx} y={box.y + 18} fontSize={6} textAnchor="middle" fill="#e2e8f0" pointerEvents="none">{r ? shortMode(r.mode) : ''}</text>
          {r?.reach && <text x={cx} y={box.y + 24} fontSize={5.5} textAnchor="middle" fill="#fde68a" pointerEvents="none">{r.reach}</text>}
        </>
      ) : (
        <text x={cx} y={box.y + box.h / 2 + 3} fontSize={box.group.count > 1 ? 7 : 6} textAnchor="middle" fill="#fff" pointerEvents="none">
          {box.group.count > 1 ? box.index : box.group.label}
        </text>
      )}
    </g>
  );
}
