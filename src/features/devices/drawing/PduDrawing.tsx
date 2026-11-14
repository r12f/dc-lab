import type { DeviceDefinition } from '../../../domain/device/types';
import { formatPower } from '../../../domain/units';
import { layoutPdu } from './pduLayout';
import { PortGlyph } from './PortGlyph';
import { PHASE_COLORS } from './portStyle';
import type { DrawingContext } from './types';
import type { DrawingSize } from './RackDeviceDrawing';
import { paint } from '../../../theme/paint';

export function pduSize(device: DeviceDefinition): DrawingSize {
  const l = layoutPdu(device);
  return { width: l.width + 120, height: l.height };
}

/** Vertical (0U) PDU: input feed, mgmt ports, then outlet banks with breaker and phase. */
export function PduDrawing({ device, ctx }: { device: DeviceDefinition; ctx: DrawingContext }) {
  const l = layoutPdu(device);
  const input = device.pdu;
  return (
    <g>
      <line x1={l.width / 2} x2={l.width / 2} y1={-6} y2={4} stroke="#111827" strokeWidth={6} />
      <rect width={l.width} height={l.height} rx={6} fill="#1f2937" stroke="#f59e0b" strokeWidth={2} />
      <text x={l.width / 2} y={18} fontSize={9} textAnchor="middle" fill="#fff" fontWeight={700}>INPUT</text>
      <text x={l.width / 2} y={30} fontSize={7} textAnchor="middle" fill="#cbd5e1">
        {input ? `${input.phases}Φ ${input.voltageV}V ${input.inputCurrentA}A` : ''}
      </text>
      <text x={l.width / 2} y={40} fontSize={6.5} textAnchor="middle" fill="#94a3b8">{input?.inputPlug ?? ''}</text>
      {l.headerPorts.map((p) => <PortGlyph key={p.ref} box={p} ctx={ctx} />)}
      {l.banks.map((b) => {
        const g = b.groups[0];
        const phaseColor = g?.phase ? PHASE_COLORS[g.phase] : '#475569';
        const count = b.groups.reduce((n, x) => n + x.count, 0);
        return (
          <g key={b.bank}>
            <rect x={6} y={b.y} width={l.width - 12} height={b.h} rx={4} fill="#111827" stroke={phaseColor} strokeWidth={2} />
            <rect x={6} y={b.y} width={10} height={b.h} fill={phaseColor} />
            <text x={20} y={b.y + 12} fontSize={8} fill="#fff" fontWeight={700}>{`Bank ${b.bank}`}</text>
            <text x={l.width - 10} y={b.y + 12} fontSize={7} textAnchor="end" fill="#fcd34d">
              {`${g?.phase ?? ''} ${g?.breakerA ? `${g.breakerA}A` : ''}`}
            </text>
            <text x={l.width + 10} y={b.y + b.h / 2 + 3} fontSize={9} fill={paint.inkMuted}>
              {`Bank ${b.bank}: ${count} outlets · ${g?.phase ?? '?'}${g?.breakerA ? ` · ${g.breakerA}A breaker` : ''}`}
            </text>
          </g>
        );
      })}
      {l.ports.map((p) => <PortGlyph key={p.ref} box={p} ctx={ctx} />)}
      <text x={l.width + 10} y={14} fontSize={9} fill={paint.inkMuted}>{`Capacity ${formatPower(device.power.capacityW ?? 0)}`}</text>
    </g>
  );
}
