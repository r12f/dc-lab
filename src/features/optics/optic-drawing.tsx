import type { Ref } from 'react';
import type { OpticDefinition } from '../../domain/optics/types';
import { paint } from '../../theme/paint';
import { ConnectorGlyph, CONNECTOR_H, CONNECTOR_W } from './connector-glyph';

interface Props {
  ref?: Ref<SVGSVGElement>;
  optic: OpticDefinition;
}

const BODY_W = 300;
const BODY_H = 110;
const LEG_GAP = 72;
const PIGTAIL_RUN = 260;

/**
 * Side view: host connector edge on the left, module body, then either the fiber connector face
 * (module) or the pigtail legs ending in connectors (pigtail).
 */
export function OpticDrawing({ ref, optic: o }: Props) {
  const legs = o.packaging === 'pigtail' && o.pigtail ? o.pigtail.count : 0;
  const legsH = legs * LEG_GAP;
  const bodyY = 70 + Math.max(0, (legsH - BODY_H) / 2);
  const width = 40 + BODY_W + (legs ? PIGTAIL_RUN + CONNECTOR_W + 40 : 150);
  const height = Math.max(bodyY + BODY_H, 70 + legsH) + 60;
  const cy = bodyY + BODY_H / 2;
  const faceConnector = o.fiberConnector || (o.reach === 'DAC' ? 'Copper (DAC)' : '—');
  return (
    <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width={width} className="drawing">
      <rect width={width} height={height} fill={paint.paper} />
      <text x={20} y={30} fontSize={20} fontWeight={700} fill={paint.ink}>{o.name}</text>
      <text x={20} y={52} fontSize={14} fill={paint.inkMuted}>
        {`${o.packaging === 'pigtail' ? 'Pigtail optic' : 'Pluggable module'} · ${o.powerW} W · ${o.reachM} m`}
      </text>
      {/* Host edge connector */}
      <rect x={20} y={cy - 22} width={22} height={44} fill={paint.frame} />
      <rect x={40} y={bodyY} width={BODY_W} height={BODY_H} rx={8} fill={paint.slot} stroke={paint.ink} strokeWidth={1.5} />
      <text x={40 + BODY_W / 2} y={cy - 12} fontSize={22} fontWeight={700} textAnchor="middle" fill={paint.ink}>{`${o.formFactor} ${o.speedGbps ? `${o.speedGbps}G` : ''}`}</text>
      <text x={40 + BODY_W / 2} y={cy + 18} fontSize={18} textAnchor="middle" fill={paint.ink}>{o.reach}</text>
      {legs === 0 ? (
        <>
          <rect x={40 + BODY_W - 14} y={cy - 26} width={14} height={52} fill={paint.accent} />
          <text x={40 + BODY_W + 14} y={cy + 6} fontSize={16} fill={paint.ink}>{faceConnector}</text>
        </>
      ) : Array.from({ length: legs }, (_, i) => {
        const ly = 70 + i * LEG_GAP + LEG_GAP / 2;
        const sx = 40 + BODY_W;
        const ex = sx + PIGTAIL_RUN;
        const color = o.pigtail!.fiberType === 'fiber-mm' ? '#22d3ee' : '#facc15';
        return (
          <g key={i}>
            <path d={`M${sx},${cy} C${sx + 120},${cy} ${ex - 120},${ly} ${ex},${ly}`} fill="none" stroke="#0f172a" strokeWidth={7} />
            <path d={`M${sx},${cy} C${sx + 120},${cy} ${ex - 120},${ly} ${ex},${ly}`} fill="none" stroke={color} strokeWidth={4} />
            <ConnectorGlyph x={ex} y={ly - CONNECTOR_H / 2} label={o.pigtail!.connector} facing="left" />
          </g>
        );
      })}
      {legs > 0 && (
        <text x={40 + BODY_W + PIGTAIL_RUN / 2} y={height - 16} fontSize={14} textAnchor="middle" fill={paint.inkMuted}>
          {`${legs}x ${o.pigtail!.fiberType === 'fiber-mm' ? 'MMF' : 'SMF'} pigtail · ${o.pigtail!.lengthM} m`}
        </text>
      )}
    </svg>
  );
}
