import type { PortBox } from './faceplate-layout';
import type { DrawingContext } from './types';
import { idColor, modeColor, ROLE_COLORS, speedLabel } from './port-style';
import { ROLE_TRAITS } from '../../../domain/device/roles';
import { formFactorSpec } from '../../../domain/ports/form-factors';
import { portConnectors } from '../../../domain/ports/optic-match';
import { ConnectorBoxes } from './connector-boxes';
import { portLabel } from '../../../domain/device/port-label';
import { paint } from '../../../theme/paint';

/**
 * One port of any device. Every port shows its index and interface + mode ("OSFP 2x400G", "RJ45 1G",
 * "C13"). Data/service ports add the reach, a top strip for the module/reach, and one sub-box per cable
 * connector (e.g. 2xDR4 -> two MPO-12) at the bottom, filled with the attached cable's color.
 */
/** Largest font (down to 6) at which `text` fits the port width. */
function fitFont(text: string, width: number, max: number): number {
  return Math.max(6, Math.min(max, (width - 4) / (text.length * 0.58)));
}

export function PortGlyph({ box, ctx }: { box: PortBox; ctx: DrawingContext }) {
  const r = ctx.resolve(box.ref);
  const pluggable = ROLE_TRAITS[box.group.role].pluggable;
  const fill = pluggable && r ? modeColor(r.mode) : ROLE_COLORS[box.group.role];
  const sel = ctx.selectedPorts.has(box.ref);
  const optic = r?.optic;
  const cable = r?.cableId ? ctx.lib.cableMedia.get(r.cableId) : undefined;
  const fiberPort = formFactorSpec(box.group.formFactor).kind === 'fiber';
  const cx = box.x + box.w / 2;
  const speed = r ? speedLabel(r.mode) : '';
  const iface = portLabel(box.group, r?.mode);
  const conns = pluggable && r ? portConnectors(box.group, optic, r.reach) : undefined;
  const engine = box.group.opticalEngine ? ` · ${box.group.opticalEngine.toUpperCase()}` : '';
  const tip = [
    `${box.ref} · ${box.group.formFactor}${engine} · ${ROLE_TRAITS[box.group.role].label}`,
    speed ? `Speed ${speed}` : '',
    r?.reach ? `Reach ${r.reach}` : '',
    optic ? `Module ${optic.name}${r?.autoOptic ? ' (auto)' : ''}` : '',
    conns ? `Connectors ${conns.count}x ${conns.connector}` : '',
    cable ? `Cable ${cable.name}` : '',
  ].filter(Boolean).join('\n');
  const markColor = optic ? idColor(optic.id) : r?.reach ? idColor(r.reach) : undefined;
  const t = (y: number, size: number, fill: string, text: string, bold = false) => (
    <text x={cx} y={box.y + y} fontSize={size} textAnchor="middle" fill={fill} fontWeight={bold ? 700 : 500} pointerEvents="none">{text}</text>
  );
  return (
    <g style={{ cursor: 'pointer' }} onClick={(e) => ctx.onPortClick?.(box.ref, e.ctrlKey || e.metaKey || e.shiftKey)}>
      <title>{tip}</title>
      {/* Fiber ports (CPO/NPO) are drawn rounded to set them apart from module cages. */}
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={fiberPort ? 12 : 3} fill={fill}
        stroke={sel ? paint.selection : '#0f172a'} strokeWidth={sel ? 3 : 1} />
      {markColor && <rect x={box.x + 3} y={box.y + 3} width={box.w - 6} height={4} fill={markColor} pointerEvents="none" />}
      {conns && <ConnectorBoxes box={box} conns={conns} color={cable?.color} />}
      {pluggable ? (
        <>
          {t(19, 12, '#fff', String(box.index), true)}
          {t(31, fitFont(iface, box.w, 10), '#f1f5f9', iface, true)}
          {r?.reach && t(42, 9, '#fde68a', r.reach)}
        </>
      ) : (
        <>
          {t(box.h / 2 - 2, 10, '#fff', box.group.count > 1 ? String(box.index) : box.group.label, true)}
          {t(box.h / 2 + 10, fitFont(iface, box.w, 9), '#e2e8f0', iface)}
        </>
      )}
    </g>
  );
}
