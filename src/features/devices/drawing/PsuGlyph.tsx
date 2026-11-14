import type { Box } from './faceplateLayout';

/** A hot-swap PSU module: handle, status LED and inlet. */
export function PsuGlyph({ box, index, inlet, ratedW }: { box: Box; index: number; inlet: string; ratedW: number }) {
  return (
    <g>
      <title>{`PSU${index} · ${inlet} · ${ratedW} W`}</title>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={3} fill="#334155" stroke="#94a3b8" />
      <rect x={box.x + 4} y={box.y + 6} width={14} height={box.h - 12} rx={2} fill="#0f172a" stroke="#64748b" />
      <circle cx={box.x + box.w - 7} cy={box.y + 7} r={2.5} fill="#22c55e" />
      <text x={box.x + 30} y={box.y + 16} fontSize={7} textAnchor="middle" fill="#fff" fontWeight={700}>{`PSU${index}`}</text>
      <text x={box.x + 30} y={box.y + 26} fontSize={6} textAnchor="middle" fill="#cbd5e1">{inlet}</text>
    </g>
  );
}
