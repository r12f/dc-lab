import type { Ref } from 'react';
import type { BreakoutProfile, DeviceDefinition } from '../../domain/device/types';
import { effectiveMode } from '../../domain/device/breakout';
import { traitsOf } from '../../domain/device/categories';
import { formatHeight, formatPower } from '../../domain/units';
import { layoutFace, type FaceLayout } from './faceplateLayout';
import { modeColor } from './modeColors';

interface Props {
  ref?: Ref<SVGSVGElement>;
  device: DeviceDefinition;
  profile?: BreakoutProfile;
  selectedPort?: string;
  /** Instance-level breakout per port ref (rack designer). */
  instanceModes?: Record<string, string | undefined>;
  onSelectPort?(ref: string): void;
}

const SCALE_W = 900;

function Face({ layout, y, device, profile, selectedPort, instanceModes, onSelectPort }: Props & { layout: FaceLayout; y: number }) {
  const color = traitsOf(device.category).color;
  return (
    <g transform={`translate(0 ${y})`}>
      <text x={0} y={-6} fontSize={12} fill="#334155" fontWeight={600}>{layout.face.toUpperCase()}</text>
      <rect width={layout.width} height={layout.height} rx={4} fill="#1e293b" stroke={color} strokeWidth={2} />
      {layout.ports.length === 0 && (
        <text x={12} y={layout.height / 2 + 4} fontSize={11} fill="#94a3b8">No ports on this face</text>
      )}
      {layout.ports.filter((p) => p.index === 1).map((p) => (
        <text key={`l-${p.group.id}`} x={p.x} y={p.y - 4} fontSize={9} fill="#cbd5e1">{p.group.label}</text>
      ))}
      {layout.ports.map((p) => {
        const mode = effectiveMode(device, p.ref, profile, instanceModes?.[p.ref]);
        const sel = p.ref === selectedPort;
        return (
          <g key={p.ref} onClick={() => onSelectPort?.(p.ref)} style={{ cursor: 'pointer' }}>
            <title>{`${p.ref} ${p.group.connector} ${mode}`}</title>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={2}
              fill={modeColor(mode)} stroke={sel ? '#facc15' : '#0f172a'} strokeWidth={sel ? 2.5 : 1} />
            <text x={p.x + p.w / 2} y={p.y + p.h / 2 + 3} fontSize={7} textAnchor="middle" fill="#fff">{p.index}</text>
          </g>
        );
      })}
    </g>
  );
}

/** Front and rear faceplates of a device with ports colored by effective breakout mode. */
export function DeviceFaceplate(props: Props) {
  const { device, ref } = props;
  const front = layoutFace(device, 'front', SCALE_W);
  const rear = layoutFace(device, 'rear', SCALE_W);
  const width = Math.max(front.width, rear.width);
  const header = 46;
  const height = header + front.height + 30 + rear.height + 20;
  return (
    <svg ref={ref} viewBox={`-20 -10 ${width + 40} ${height + 10}`} width={width + 40} className="drawing">
      <rect x={-20} y={-10} width={width + 40} height={height + 10} fill="#ffffff" />
      <text x={0} y={8} fontSize={16} fontWeight={700} fill="#0f172a">{device.name}</text>
      <text x={0} y={26} fontSize={11} fill="#475569">
        {`${device.vendor} ${device.model} · ${traitsOf(device.category).label} · ${formatHeight(device.height)} · ` +
          `${formatPower(device.power.typicalW)} typ / ${formatPower(device.power.maxW)} max · ${device.weightKg} kg`}
      </text>
      <Face {...props} layout={front} y={header} />
      <Face {...props} layout={rear} y={header + front.height + 30} />
    </svg>
  );
}
