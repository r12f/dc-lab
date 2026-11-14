import type { Box } from './faceplate-layout';

/** A hot-swap PSU module: handle, status LED, name, inlet and rating. */
export function PsuGlyph({ box, index, inlet, ratedW }: { box: Box; index: number; inlet: string; ratedW: number }) {
  const tx = box.x + 24 + (box.w - 24) / 2;
  return (
    <g>
      <title>{`PSU${index} · ${inlet} · ${ratedW} W`}</title>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={4} fill="#334155" stroke="#94a3b8" />
      <rect x={box.x + 5} y={box.y + 8} width={16} height={box.h - 16} rx={2} fill="#0f172a" stroke="#64748b" />
      <circle cx={box.x + box.w - 8} cy={box.y + 8} r={3} fill="#22c55e" />
      <text x={tx} y={box.y + 20} fontSize={12} textAnchor="middle" fill="#fff" fontWeight={700}>{`PSU${index}`}</text>
      <text x={tx} y={box.y + 34} fontSize={10} textAnchor="middle" fill="#cbd5e1">{inlet}</text>
      <text x={tx} y={box.y + 46} fontSize={9} textAnchor="middle" fill="#94a3b8">{ratedW ? `${ratedW} W` : ''}</text>
    </g>
  );
}
