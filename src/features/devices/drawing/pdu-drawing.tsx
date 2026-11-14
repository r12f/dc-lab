import type { DeviceDefinition } from '../../../domain/device/types';
import { formatPower } from '../../../domain/units';
import { layoutPdu } from './pdu-layout';
import { PortGlyph } from './port-glyph';
import { PHASE_COLORS } from './port-style';
import type { DrawingContext } from './types';
import type { DrawingSize } from './rack-device-drawing';
import { paint } from '../../../theme/paint';

export function pduSize(device: DeviceDefinition): DrawingSize {
  const l = layoutPdu(device);
  return { width: l.width + 300, height: l.height };
}

/** Vertical (0U) PDU: input feed, mgmt ports, then outlet banks with breaker and phase. */
export function PduDrawing({ device, ctx }: { device: DeviceDefinition; ctx: DrawingContext }) {
  const l = layoutPdu(device);
  const input = device.pdu;
  return (
    <g>
      <line x1={l.width / 2} x2={l.width / 2} y1={-8} y2={4} stroke="#111827" strokeWidth={8} />
      <rect width={l.width} height={l.height} rx={6} fill="#1f2937" stroke="#64748b" strokeWidth={2} />
      <text x={l.width / 2} y={24} fontSize={13} textAnchor="middle" fill="#fff" fontWeight={700}>INPUT</text>
      <text x={l.width / 2} y={42} fontSize={11} textAnchor="middle" fill="#cbd5e1">
        {input ? `${input.phases}Φ ${input.voltageV}V ${input.inputCurrentA}A` : ''}
      </text>
      <text x={l.width / 2} y={56} fontSize={9.5} textAnchor="middle" fill="#94a3b8">{input?.inputPlug ?? ''}</text>
      {l.headerPorts.map((p) => <PortGlyph key={p.ref} box={p} ctx={ctx} />)}
      {l.banks.map((b) => {
        const g = b.groups[0];
        const phaseColor = g?.phase ? PHASE_COLORS[g.phase] : '#475569';
        const count = b.groups.reduce((n, x) => n + x.count, 0);
        return (
          <g key={b.bank}>
            <rect x={6} y={b.y} width={l.width - 12} height={b.h} rx={4} fill="#111827" stroke={phaseColor} strokeWidth={2} />
            <rect x={6} y={b.y} width={14} height={b.h} fill={phaseColor} />
            <text x={26} y={b.y + 18} fontSize={12} fill="#fff" fontWeight={700}>{`Bank ${b.bank}`}</text>
            <text x={l.width - 12} y={b.y + 18} fontSize={11} textAnchor="end" fill="#93c5fd">
              {`${g?.phase ?? ''} ${g?.breakerA ? `${g.breakerA}A` : ''}`}
            </text>
            <text x={l.width + 14} y={b.y + b.h / 2 + 4} fontSize={13} fill={paint.inkMuted}>
              {`Bank ${b.bank}: ${count} outlets · ${g?.phase ?? '?'}${g?.breakerA ? ` · ${g.breakerA}A breaker` : ''}`}
            </text>
          </g>
        );
      })}
      {l.ports.map((p) => <PortGlyph key={p.ref} box={p} ctx={ctx} />)}
      <text x={l.width + 14} y={20} fontSize={13} fill={paint.inkMuted}>{`Capacity ${formatPower(device.power.capacityW ?? 0)}`}</text>
    </g>
  );
}
