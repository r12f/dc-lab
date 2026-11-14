import type { PortConnectors } from '../../../domain/ports/opticMatch';
import type { PortBox } from './faceplateLayout';

interface Props {
  box: PortBox;
  conns: PortConnectors;
  /** Attached cable color; undefined = no cable (dark connector). */
  color?: string;
}

const H = 15;
const GAP = 2;
const INSET = 3;

/** Connector text that fits a sub-box: full name, else its trailing number ("MPO-12" -> "12"), else none. */
function fitLabel(connector: string, width: number, font: number): { text: string; font: number } {
  for (const f of [font, font - 1, font - 1.5]) if (connector.length * f * 0.58 <= width - 2) return { text: connector, font: f };
  const digits = /(\d+)$/.exec(connector)?.[1];
  return { text: digits && digits.length * font * 0.6 <= width - 2 ? digits : '', font };
}

/** One sub-box per cable connector along the bottom of a port, in rows of up to 4. */
export function ConnectorBoxes({ box, conns, color }: Props) {
  const perRow = Math.min(conns.count, 4);
  const rows = Math.ceil(conns.count / perRow);
  const h = rows > 1 ? (H - GAP) / 2 + 2 : H;
  const w = (box.w - INSET * 2 - GAP * (perRow - 1)) / perRow;
  const font = rows > 1 ? 7 : 8;
  const top = box.y + box.h - INSET - rows * h - (rows - 1) * GAP;
  const fill = color ?? '#1e293b';
  const ink = color ? '#0f172a' : '#e2e8f0';
  return (
    <g pointerEvents="none">
      {Array.from({ length: conns.count }, (_, i) => {
        const x = box.x + INSET + (i % perRow) * (w + GAP);
        const y = top + Math.floor(i / perRow) * (h + GAP);
        const label = fitLabel(conns.connector, w, font);
        const f = label.font;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx={2} fill={fill} stroke="#f8fafc" strokeWidth={0.8} />
            {label.text && <text x={x + w / 2} y={y + h / 2 + f * 0.36} fontSize={f} textAnchor="middle" fill={ink} fontWeight={600}>{label.text}</text>}
          </g>
        );
      })}
    </g>
  );
}
