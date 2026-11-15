import type { ResolvedPort } from '../device/port-settings';
import type { PortGroup } from '../device/types';
import { parseMode } from '../device/breakout';
import { formatGbps } from '../units';
import { portConnectors } from './optic-match';
import { genderedConnector } from '../optics/connectors';
import type { ConnectorGender } from '../optics/types';

/**
 * One physical cable connector of a port and the traffic it carries: a 2xDR4 module running 8x100G has two
 * legs, each "4x100G DR4" on an MPO-12. Ports without a module connector (empty cage, DAC/AEC/AOC, RJ45, LC
 * fiber ports) are a single leg whose connector is the port itself; `index` is then undefined.
 */
export interface PortLeg {
  /** 1-based leg (cable endpoint `connector`); undefined = the port itself. */
  index?: number;
  connector: string;
  /** Lanes on this leg: "4x100G", "400G"; empty for unrated ports. */
  mode: string;
  /** Reach class on this leg: "DR4" for each leg of a 2xDR4 module. */
  reach?: string;
  /** "4x100G DR4 MPO-12". */
  label: string;
  /** Total speed of the port's mode (Gbps), for direct-attach cable speed checks. */
  portGbps: number;
  /** Gender of the cable end this leg takes (shown in the label: "MPO-12F" = plug a female end in). */
  cableGender?: ConnectorGender;
}

/** The share of a port mode on one of `legs` legs: 8x100G over 2 legs -> "4x100G"; 800G over 2 -> "400G". */
export function legMode(mode: string, legs: number): string {
  const m = parseMode(mode);
  if (!m || m.speedGbps === 0) return '';
  const per = m.fanout % legs === 0 ? { fanout: m.fanout / legs, speed: m.speedGbps } : { fanout: 1, speed: (m.fanout * m.speedGbps) / legs };
  return per.fanout === 1 ? formatGbps(per.speed) : `${per.fanout}x${formatGbps(per.speed)}`;
}

/** Reach of one leg: "2xDR4" over 2 legs -> "DR4"; otherwise unchanged. */
export function legReach(reach: string | undefined, legs: number): string | undefined {
  if (!reach) return undefined;
  const m = /^(\d+)x\s*(.+)$/i.exec(reach.trim());
  return m && Number(m[1]) === legs ? m[2] : reach;
}

export function portLegs(group: PortGroup, r: ResolvedPort | undefined): PortLeg[] {
  const mode = r?.mode ?? '';
  const m = parseMode(mode);
  const portGbps = m ? m.fanout * m.speedGbps : 0;
  const conns = r ? portConnectors(group, r.optic) : undefined;
  if (!conns) {
    const lm = legMode(mode, 1);
    const reach = r?.reach;
    return [{ connector: group.formFactor, mode: lm, reach, portGbps, cableGender: group.cableGender,
      label: [lm, reach, genderedConnector(group.formFactor, group.cableGender)].filter(Boolean).join(' ') }];
  }
  const lm = legMode(mode, conns.count);
  const reach = legReach(r?.reach, conns.count);
  return Array.from({ length: conns.count }, (_, i) => ({
    index: i + 1, connector: conns.connector, mode: lm, reach, portGbps, cableGender: conns.cableGender,
    label: [lm, reach, genderedConnector(conns.connector, conns.cableGender)].filter(Boolean).join(' '),
  }));
}
