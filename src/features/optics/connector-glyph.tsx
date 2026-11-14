import { paint } from '../../theme/paint';

interface Props {
  x: number;
  y: number;
  label: string;
  /** Side the cable/fiber leaves from. */
  facing: 'left' | 'right';
}

export const CONNECTOR_W = 64;
export const CONNECTOR_H = 40;

/** A fiber/cable connector end: body with a ferrule face on the mating side, label below. */
export function ConnectorGlyph({ x, y, label, facing }: Props) {
  const faceX = facing === 'right' ? x : x + CONNECTOR_W - 8;
  return (
    <g>
      <rect x={x} y={y} width={CONNECTOR_W} height={CONNECTOR_H} rx={5} fill={paint.slot} stroke={paint.ink} strokeWidth={1.2} />
      <rect x={faceX} y={y + 6} width={8} height={CONNECTOR_H - 12} fill={paint.accent} />
      <text x={x + CONNECTOR_W / 2} y={y + CONNECTOR_H + 18} fontSize={14} textAnchor="middle" fill={paint.ink}>{label}</text>
    </g>
  );
}
