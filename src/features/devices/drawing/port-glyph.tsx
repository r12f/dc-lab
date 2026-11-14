import type { PortBox } from './faceplate-layout';
import type { DrawingContext } from './types';
import { idColor, modeColor, ROLE_COLORS, speedLabel } from './port-style';
import { ROLE_TRAITS } from '../../../domain/device/roles';
import { formFactorSpec } from '../../../domain/ports/form-factors';
import { portConnectors } from '../../../domain/ports/optic-match';
import { portLabel } from '../../../domain/device/port-label';
import { portLegs, type PortLeg } from '../../../domain/ports/legs';
import { paint } from '../../../theme/paint';

/**
 * One port of any device, three lines: index; form factor + breakout ("OSFP 8x100G"); then for data/service
 * ports one cell per cable connector, each "connector / reach" ("MPO-12 / DR4 | MPO-12 / DR4" for a 2xDR4
 * module). A top strip marks the module/reach.
 */
/** Largest font (down to 6) at which bold `text` fits the port width (bold glyphs ≈ 0.68 em). */
function fitFont(text: string, width: number, max: number): number {
  return Math.max(6, Math.min(max, (width - 6) / (text.length * 0.68)));
}

const CELL_TOP = 31;
const INSET = 3;
const GAP = 2;

/**
 * One cell per cable connector along the bottom of a port, side by side: connector type on top, reach below
 * ("MPO-12" / "DR4"). Filled with the attached cable's color; a port without a module connector (empty cage,
 * DAC) shows its reach only.
 */
function LegCells({ box, legs, cabled, color }: { box: PortBox; legs: PortLeg[]; cabled: boolean; color?: string }) {
  const n = legs.length;
  const w = (box.w - INSET * 2 - GAP * (n - 1)) / n;
  const y = box.y + CELL_TOP;
  const h = box.h - CELL_TOP - INSET;
  const fill = cabled ? color ?? '#1e293b' : 'transparent';
  const ink = cabled && !color ? '#e2e8f0' : '#0f172a';
  const fit = (s: string, max: number) => Math.max(5, Math.min(max, (w - 3) / Math.max(1, s.length * 0.6)));
  return (
    <g pointerEvents="none">
      {legs.map((l, i) => {
        const x = box.x + INSET + i * (w + GAP);
        const conn = cabled ? l.connector : '';
        const reach = l.reach ?? '';
        return (
          <g key={i}>
            {cabled && <rect x={x} y={y} width={w} height={h} rx={2} fill={fill} stroke="#334155" strokeWidth={0.8} />}
            {conn && <text x={x + w / 2} y={y + h * 0.42} fontSize={fit(conn, 8)} textAnchor="middle" fill={ink} fontWeight={700}>{conn}</text>}
            {reach && <text x={x + w / 2} y={y + h * (conn ? 0.85 : 0.6)} fontSize={fit(reach, 8)} textAnchor="middle" fill={cabled ? ink : '#92400e'} fontWeight={500}>{reach}</text>}
          </g>
        );
      })}
    </g>
  );
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
  const conns = pluggable && r ? portConnectors(box.group, optic) : undefined;
  // Per-connector view: a 2xDR4 module at 8x100G is two legs, each "4x100G DR4" on an MPO-12.
  const legs = pluggable && r ? portLegs(box.group, r) : [];
  const multi = legs.length > 1;
  const engine = box.group.opticalEngine ? ` · ${box.group.opticalEngine.toUpperCase()}` : '';
  const tip = [
    `${box.ref} · ${box.group.formFactor}${engine} · ${ROLE_TRAITS[box.group.role].label}`,
    speed ? `Speed ${speed}` : '',
    r?.reach ? `Reach ${r.reach}` : '',
    optic ? `Module ${optic.name}${r?.autoOptic ? ' (auto)' : ''}` : '',
    ...(multi ? legs.map((l) => `Connector ${l.index}: ${l.label}`) : [conns ? `Connectors ${conns.count}x ${conns.connector}` : '']),
    cable ? `Cable ${cable.name}` : '',
  ].filter(Boolean).join('\n');
  const markColor = optic ? idColor(optic.id) : r?.reach ? idColor(r.reach) : undefined;
  // Text never spills into the next port: the font shrinks to fit (never stretched or squeezed).
  const t = (y: number, size: number, fill: string, text: string, bold = false) => {
    const em = bold ? 0.68 : 0.6;
    const fit = Math.min(size, (box.w - 6) / Math.max(1, text.length * em));
    return (
      <text x={cx} y={box.y + y} fontSize={Math.max(5, fit)} textAnchor="middle" fill={fill} fontWeight={bold ? 700 : 500} pointerEvents="none">{text}</text>
    );
  };
  return (
    <g style={{ cursor: 'pointer' }} onClick={(e) => ctx.onPortClick?.(box.ref, e.ctrlKey || e.metaKey || e.shiftKey)}>
      <title>{tip}</title>
      {/* Fiber ports (CPO/NPO) are drawn rounded to set them apart from module cages. */}
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={fiberPort ? 12 : 3} fill={fill}
        stroke={sel ? paint.selection : '#0f172a'} strokeWidth={sel ? 3 : 1} />
      {markColor && <rect x={box.x + 3} y={box.y + 3} width={box.w - 6} height={4} fill={markColor} pointerEvents="none" />}
      {pluggable ? (
        <>
          {t(15, 12, '#0f172a', String(box.index), true)}
          {t(27, fitFont(iface, box.w, 10), '#1e293b', iface, true)}
          {legs.length > 0 && <LegCells box={box} legs={legs} cabled={!!conns} color={cable?.color} />}
        </>
      ) : (
        <>
          {t(box.h / 2 - 2, 10, '#0f172a', box.group.count > 1 ? String(box.index) : box.group.label, true)}
          {t(box.h / 2 + 10, fitFont(iface, box.w, 9), '#334155', iface)}
        </>
      )}
    </g>
  );
}
