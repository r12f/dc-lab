import type { DeviceDefinition } from '../../../domain/device/types';
import { traitsOf } from '../../../domain/device/categories';
import { UNIT_MM } from '../../../domain/units';
import type { DrawingSize } from './rack-device-drawing';
import type { DrawingContext } from './types';
import { paint } from '../../../theme/paint';

/** Drawn width of a 19" panel face (482.6 mm) at 1 unit = 1 mm. */
const PANEL_W = 482.6;
const EAR_W = 16;

export function fillerSize(device: DeviceDefinition): DrawingSize {
  return { width: PANEL_W, height: 22 + faceHeight(device) };
}

function faceHeight(d: DeviceDefinition): number {
  return Math.max(24, d.height.units * UNIT_MM[d.height.system]);
}

/**
 * Passive front hardware at true scale (1 unit = 1 mm): a blanking panel (plain panel with mounting
 * ears and screw holes), a stiffener (structural bar with a rib), or reserved space (dashed outline, no hardware).
 */
export function FillerDrawing({ device }: { device: DeviceDefinition; ctx: DrawingContext }) {
  const h = faceHeight(device);
  const kind = traitsOf(device.category).filler;
  const holes = [EAR_W / 2, PANEL_W - EAR_W / 2];
  return (
    <g transform="translate(0 22)">
      <text x={0} y={-8} fontSize={14} fill={paint.inkMuted} fontWeight={700}>FRONT</text>
      {kind === 'reserved' ? (
        <>
          <rect width={PANEL_W} height={h} rx={2} fill="none" stroke={paint.inkMuted} strokeWidth={2} strokeDasharray="8 5" />
          <text x={PANEL_W / 2} y={h / 2 + 5} fontSize={14} textAnchor="middle" fill={paint.inkMuted} fontWeight={700}>EMPTY (RESERVED)</text>
        </>
      ) : kind === 'stiffener' ? (
        <>
          <rect width={PANEL_W} height={h} rx={2} fill="#64748b" stroke="#1e293b" strokeWidth={2} />
          <rect x={EAR_W} y={h * 0.35} width={PANEL_W - EAR_W * 2} height={h * 0.3} fill="#475569" />
          <text x={PANEL_W / 2} y={h / 2 + 5} fontSize={14} textAnchor="middle" fill="#f8fafc" fontWeight={700}>STIFFENER</text>
        </>
      ) : (
        <>
          <rect width={PANEL_W} height={h} rx={2} fill="#1f2937" stroke="#475569" strokeWidth={2} />
          <rect x={EAR_W} y={2} width={PANEL_W - EAR_W * 2} height={h - 4} fill="#111827" />
          <text x={PANEL_W / 2} y={h / 2 + 5} fontSize={14} textAnchor="middle" fill="#94a3b8" fontWeight={700}>BLANKING PANEL</text>
        </>
      )}
      {kind !== 'reserved' && holes.map((x) => <circle key={x} cx={x} cy={h / 2} r={3} fill="#0f172a" stroke="#94a3b8" />)}
    </g>
  );
}
