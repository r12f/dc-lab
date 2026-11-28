import type { Library } from '../library/library';
import type { BreakoutProfile, DeviceDefinition, PortGroup } from '../device/types';
import type { CableEnd, CableMedia, OpticDefinition } from '../optics/types';
import { parseMode } from '../device/breakout';
import { resolvePort } from '../device/port-settings';
import {
  cablesPerPort,
  compatibleCables,
  directAttachType,
  expectedCableGender,
  fiberTypeFor,
  isEnginePort,
  modeTotalGbps,
  opticFitsCage,
} from '../ports/optic-match';
import { formFactorSpec, heatSinkOf, moduleFits } from '../ports/form-factors';
import { isDirectAttach } from '../optics/cable-types';
import { connectorsMate, genderFits, isMultiFiber, matingGender, MODULE_FACE_GENDER } from '../optics/connectors';
import { formatGbps } from '../units';
import { portNumber, type Problem, type VEnd, type VGroup, type VLink, type VirtualTopo } from './virtual';

/** A topology port on its device type: the device port (cage) it sits in and the cage's breakout. */
export interface DevicePort {
  /** Device port, `<port group id>/<index>`: the data port of the name's number. */
  cage: string;
  /** Port group of the cage. */
  group: PortGroup;
  /** Breakout mode of the cage under the matched profile ("2x400G"). */
  mode: string;
  /** Ways the cage is broken out, and the speed of each. */
  fanout: number;
  speedGbps: number;
}

/** A group's members as their device type, running the breakout profile that gives the group's ports. */
export interface GroupHardware {
  device?: DeviceDefinition;
  /** Breakout profile of the device type matched to the group's ports; none fits: undefined. */
  profile?: BreakoutProfile;
  /** Topology port name -> device port, under `profile`. */
  ports: Map<string, DevicePort>;
  problems: Problem[];
}

type DataPorts = { ref: string; group: PortGroup }[];

/** "x" or "x (and 3 more)". */
const firstOf = (xs: string[]) => `${xs[0]}${xs.length > 1 ? ` (and ${xs.length - 1} more)` : ''}`;

/** A device type's data ports in front-panel order (its data port groups in order, each port in order). */
export function dataPorts(device: DeviceDefinition): DataPorts {
  return device.ports.filter((g) => g.role === 'data')
    .flatMap((g) => Array.from({ length: g.count }, (_, i) => ({ ref: `${g.id}/${i + 1}`, group: g })));
}

/**
 * The device port (cage) a pool port names: `fe1` -> port 1 of port group `fe`; any other prefix -> the data port of
 * that number in front-panel order (`etp12b` -> the 12th). Undefined: no number, or no such port.
 */
export function cageOf(device: DeviceDefinition, data: DataPorts, name: string): { ref: string; group: PortGroup } | undefined {
  const p = portNumber(name);
  if (!p) return undefined;
  const own = device.ports.find((g) => g.id === p.prefix);
  if (own) return p.n >= 1 && p.n <= own.count ? { ref: `${own.id}/${p.n}`, group: own } : undefined;
  return data[p.n - 1];
}

/** Port groups of the cages a pool's ports sit in. */
export function poolCageGroups(device: DeviceDefinition, g: VGroup, pool: string, data = dataPorts(device)): PortGroup[] {
  return [...new Set((g.poolNames[pool] ?? []).map((n) => cageOf(device, data, n)?.group).filter((x): x is PortGroup => !!x))];
}

/** Pool ports that name no device port (no number, or no port of that number). */
function numberProblems(device: DeviceDefinition, g: VGroup, data: DataPorts): Problem[] {
  const problems: Problem[] = [];
  for (const [pool, names] of Object.entries(g.poolNames)) {
    const none = names.filter((n) => !portNumber(n));
    const past = names.filter((n) => !!portNumber(n) && !cageOf(device, data, n));
    if (none.length) problems.push({ message: `group ${g.name}: pool ${pool} port ${firstOf(none)} has no port number` });
    if (past.length) problems.push({ message: `group ${g.name}: pool ${pool} names ${firstOf(past)}, ${device.name} has no such port (${data.length} data ports)` });
  }
  return problems;
}

/** Optics set on a group's pools: known, fitting the cages, matching heat sink, and no faster than the cage. */
function poolOpticProblems(lib: Library, g: VGroup, device: DeviceDefinition | undefined, data: DataPorts): Problem[] {
  const problems: Problem[] = [];
  const say = (message: string) => problems.push({ message: `group ${g.name}: pool ${message}` });
  const cages = (pool: string) => (device ? poolCageGroups(device, g, pool, data) : []);
  for (const [pool, id] of Object.entries(g.poolOptics)) {
    const o = lib.optics.get(id);
    if (!o) { say(`${pool} optic "${id}" is not in Optics & Cables`); continue; }
    for (const cg of cages(pool)) {
      if (!moduleFits(cg.formFactor, o.formFactor)) say(`${pool}: ${o.name} does not fit the ${cg.formFactor} cages`);
      else if (!opticFitsCage(cg, o)) say(`${pool}: ${o.name} is ${heatSinkOf(o)}, the ${cg.formFactor} cages ${heatSinkOf(cg)}`);
      else if (o.speedGbps > cg.speedGbps) say(`${pool}: ${o.name} is ${formatGbps(o.speedGbps)}, the ${cg.formFactor} cages ${formatGbps(cg.speedGbps)}`);
    }
  }
  return problems;
}

interface LinkSideInfo {
  readonly end: VEnd;
  readonly group: VGroup;
  readonly device?: DeviceDefinition;
  readonly cages: PortGroup[];
  readonly resolvedPorts: DevicePort[];
  readonly opticId?: string;
  readonly optic?: OpticDefinition;
}

function buildLinkSide(lib: Library, end: VEnd, group: VGroup, ghw: GroupHardware | undefined): LinkSideInfo {
  const device = ghw?.device;
  const cages = device ? poolCageGroups(device, group, end.ports) : [];
  const resolvedPorts = (group.poolNames[end.ports] ?? [])
    .map((n) => ghw?.ports.get(n))
    .filter((p): p is DevicePort => !!p);
  const opticId = group.poolOptics[end.ports];
  const optic = opticId ? lib.optics.get(opticId) : undefined;
  return { end, group, device, cages, resolvedPorts, opticId, optic };
}

function isCopperPatchCable(c: CableMedia): boolean {
  return (
    c.type === 'other' &&
    formFactorSpec(c.ends.a.connector).kind === 'copper' &&
    formFactorSpec(c.ends.b.connector).kind === 'copper'
  );
}

function isDataCable(c: CableMedia): boolean {
  if (c.type === 'power') return false;
  if (c.type === 'other') return isCopperPatchCable(c);
  return true;
}

function dacEndProblem(linkName: string, c: CableMedia, cableEnd: CableEnd, side: LinkSideInfo): string | undefined {
  if (side.opticId) {
    return `${linkName}: ${c.name} plugs into the cage itself, so ${side.group.name} ${side.end.ports} takes no optic`;
  }
  if (!side.device || !side.cages.length) return undefined;
  for (const cg of side.cages) {
    if (
      formFactorSpec(cg.formFactor).kind !== 'cage' ||
      isEnginePort(cg) ||
      cg.role === 'laser' ||
      !moduleFits(cg.formFactor, cableEnd.connector)
    ) {
      return `${linkName}: ${c.name} does not plug into the ${cg.formFactor} cages of ${side.group.name} ${side.end.ports}`;
    }
  }
  if (c.speedGbps) {
    const plugGbps = c.speedGbps / Math.max(1, cableEnd.count);
    if (side.resolvedPorts.length > 0) {
      const badPort = side.resolvedPorts.find((dp) => modeTotalGbps(dp.mode) !== plugGbps);
      if (badPort) {
        return `${linkName}: ${c.name} runs ${formatGbps(plugGbps)} per plug, ${side.group.name} ${side.end.ports} runs ${badPort.mode}`;
      }
    } else {
      const badCg = side.cages.find((cg) => plugGbps > cg.speedGbps);
      if (badCg) {
        return `${linkName}: ${c.name} runs ${formatGbps(plugGbps)} per plug, ${side.group.name} ${side.end.ports} cages are ${formatGbps(badCg.speedGbps)}`;
      }
    }
  }
  return undefined;
}

function patchEndProblem(
  lib: Library,
  linkName: string,
  c: CableMedia,
  cableEnd: CableEnd,
  side: LinkSideInfo,
): string | undefined {
  const copperPatch = isCopperPatchCable(c);
  if (side.optic) {
    if (copperPatch) {
      return `${linkName}: ${c.name} does not fit ${side.optic.name} on ${side.group.name} ${side.end.ports}`;
    }
    const conn = side.optic.fiberConnector.replace(/^\d+x\s*/i, '');
    if (!conn || !connectorsMate(cableEnd.connector, conn)) {
      return `${linkName}: ${c.name} does not fit ${side.optic.name} on ${side.group.name} ${side.end.ports}`;
    }
    const expGender = side.cages.length
      ? expectedCableGender(side.cages[0], side.optic)
      : side.optic.packaging === 'pigtail'
        ? matingGender(side.optic.pigtail?.gender)
        : isMultiFiber(conn)
          ? matingGender(MODULE_FACE_GENDER)
          : undefined;
    if (!genderFits(cableEnd.gender, expGender)) {
      return `${linkName}: ${c.name} does not fit ${side.optic.name} on ${side.group.name} ${side.end.ports}`;
    }
    const fiber = fiberTypeFor(side.optic.reach);
    if (fiber && c.type.startsWith('fiber') && c.type !== fiber) {
      return `${linkName}: ${c.name} does not fit ${side.optic.name} on ${side.group.name} ${side.end.ports}`;
    }
    for (const cg of side.cages) {
      if (!compatibleCables(lib, cg, side.optic).some((x) => x.id === c.id)) {
        return `${linkName}: ${c.name} does not fit ${side.optic.name} on ${side.group.name} ${side.end.ports}`;
      }
    }
    return undefined;
  }

  if (side.cages.length > 0) {
    if (side.cages.every((cg) => formFactorSpec(cg.formFactor).kind === 'copper')) {
      const ok =
        copperPatch &&
        side.cages.every((cg) => connectorsMate(cableEnd.connector, cg.formFactor) && genderFits(cableEnd.gender, cg.cableGender));
      return ok ? undefined : `${linkName}: ${c.name} does not fit ${side.group.name} ${side.end.ports}`;
    }
    if (side.cages.every((cg) => isEnginePort(cg))) {
      const ok =
        !copperPatch &&
        side.cages.every(
          (cg) =>
            connectorsMate(cableEnd.connector, cg.formFactor) &&
            genderFits(cableEnd.gender, expectedCableGender(cg)) &&
            compatibleCables(lib, cg).some((x) => x.id === c.id),
        );
      return ok ? undefined : `${linkName}: ${c.name} does not fit ${side.group.name} ${side.end.ports}`;
    }
  }

  return copperPatch
    ? `${linkName}: ${c.name} does not fit ${side.group.name} ${side.end.ports}`
    : `${linkName}: ${c.name} needs an optic in ${side.group.name} ${side.end.ports}`;
}

function sideLinksPerEnd(side: LinkSideInfo, cableEnd: CableEnd): number | undefined {
  const port = side.resolvedPorts[0];
  if (!port) return undefined;
  return (cableEnd.count * port.fanout) / cablesPerPort(port.group, side.optic);
}

function orientedLinksPerCable(sideA: LinkSideInfo, sideB: LinkSideInfo, fromEnd: CableEnd, toEnd: CableEnd): number {
  const fromPer = sideLinksPerEnd(sideA, fromEnd);
  const toPer = sideLinksPerEnd(sideB, toEnd);
  return fromPer !== undefined && toPer !== undefined
    ? Math.min(fromPer, toPer)
    : (fromPer ?? toPer ?? Math.max(1, Math.min(fromEnd.count, toEnd.count)));
}

function linkSpeedProblem(
  link: VLink,
  ga: VGroup,
  gb: VGroup,
  hw: ReadonlyMap<string, GroupHardware>,
): string | undefined {
  const ha = hw.get(ga.name);
  const hb = hw.get(gb.name);
  const sa = ha ? poolSpeeds(ga, ha, link.from.ports) : [];
  const sb = hb ? poolSpeeds(gb, hb, link.to.ports) : [];
  if (sa.length && sb.length && !(sa.length === 1 && sb.length === 1 && sa[0] === sb[0])) {
    return `${link.name}: ${link.from.group} ${link.from.ports} runs ${sa.map(formatGbps).join('/')}, ${link.to.group} ${link.to.ports} ${sb.map(formatGbps).join('/')}`;
  }
  return undefined;
}

/**
 * Orient `cable` (`ends.a` / `ends.b`) onto `(link.from, link.to)`. Returns `{ fromEnd, toEnd, problem }`,
 * where `problem` is `undefined` iff `cable` validly connects both ends of `link`.
 */
export function orientLinkCable(
  lib: Library,
  v: VirtualTopo,
  link: VLink,
  cable: CableMedia,
  hw: ReadonlyMap<string, GroupHardware> = topoHardware(lib, v),
): { fromEnd: CableEnd; toEnd: CableEnd; problem?: string } {
  const byName = new Map(v.groups.map((g) => [g.name, g]));
  const ga = byName.get(link.from.group);
  const gb = byName.get(link.to.group);
  if (!ga || !gb || !(link.from.ports in ga.pools) || !(link.to.ports in gb.pools)) {
    return { fromEnd: cable.ends.a, toEnd: cable.ends.b, problem: `${link.name}: undefined link end` };
  }
  if (!isDataCable(cable)) {
    return { fromEnd: cable.ends.a, toEnd: cable.ends.b, problem: `${link.name}: ${cable.name} is not a data cable` };
  }

  const sideA = buildLinkSide(lib, link.from, ga, hw.get(ga.name));
  const sideB = buildLinkSide(lib, link.to, gb, hw.get(gb.name));
  if ((sideA.opticId && !sideA.optic) || (sideB.opticId && !sideB.optic)) {
    return { fromEnd: cable.ends.a, toEnd: cable.ends.b, problem: `${link.name}: unknown pool optic` };
  }

  const endErr = (ce: CableEnd, side: LinkSideInfo): string | undefined =>
    isDirectAttach(cable.type) ? dacEndProblem(link.name, cable, ce, side) : patchEndProblem(lib, link.name, cable, ce, side);

  const aFromErr = endErr(cable.ends.a, sideA);
  const bToErr = endErr(cable.ends.b, sideB);
  const abOk = !aFromErr && !bToErr;

  let chosen: { fromEnd: CableEnd; toEnd: CableEnd };
  if (abOk && cable.ends.a.count === cable.ends.b.count) {
    chosen = { fromEnd: cable.ends.a, toEnd: cable.ends.b };
  } else {
    const bFromErr = endErr(cable.ends.b, sideA);
    const aToErr = endErr(cable.ends.a, sideB);
    const baOk = !bFromErr && !aToErr;
    if (abOk && baOk) {
      const abCap = orientedLinksPerCable(sideA, sideB, cable.ends.a, cable.ends.b);
      const baCap = orientedLinksPerCable(sideA, sideB, cable.ends.b, cable.ends.a);
      chosen = baCap > abCap
        ? { fromEnd: cable.ends.b, toEnd: cable.ends.a }
        : { fromEnd: cable.ends.a, toEnd: cable.ends.b };
    } else if (abOk) {
      chosen = { fromEnd: cable.ends.a, toEnd: cable.ends.b };
    } else if (baOk) {
      chosen = { fromEnd: cable.ends.b, toEnd: cable.ends.a };
    } else {
      if (!aFromErr) return { fromEnd: cable.ends.a, toEnd: cable.ends.b, problem: bToErr };
      if (!bFromErr) return { fromEnd: cable.ends.b, toEnd: cable.ends.a, problem: aToErr };
      return { fromEnd: cable.ends.a, toEnd: cable.ends.b, problem: aFromErr ?? bToErr };
    }
  }

  const speedErr = linkSpeedProblem(link, ga, gb, hw);
  if (speedErr) return { ...chosen, problem: speedErr };
  return chosen;
}

/** Validate every `link.cable` across `v.links` against both ends' pools, cages, modes, and optics. */
function mediaProblems(lib: Library, v: VirtualTopo, hw: ReadonlyMap<string, GroupHardware>): Problem[] {
  const byName = new Map(v.groups.map((g) => [g.name, g]));
  const problems: Problem[] = [];
  for (const link of v.links) {
    if (!link.cable) continue;
    const c = lib.cableMedia.get(link.cable);
    if (!c) {
      problems.push({ message: `${link.name}: cable "${link.cable}" is not in Optics & Cables` });
      continue;
    }
    const ga = byName.get(link.from.group);
    const gb = byName.get(link.to.group);
    if (!ga || !gb || !(link.from.ports in ga.pools) || !(link.to.ports in gb.pools)) continue;
    const opticA = ga.poolOptics[link.from.ports];
    const opticB = gb.poolOptics[link.to.ports];
    // Unknown optic IDs are already reported per pool in `poolOpticProblems`; still flag DAC-vs-optic conflicts.
    if (!isDirectAttach(c.type) && isDataCable(c) && ((opticA && !lib.optics.get(opticA)) || (opticB && !lib.optics.get(opticB)))) {
      continue;
    }
    if (isDirectAttach(c.type)) {
      if (opticA) {
        problems.push({ message: `${link.name}: ${c.name} plugs into the cage itself, so ${ga.name} ${link.from.ports} takes no optic` });
        continue;
      }
      if (opticB) {
        problems.push({ message: `${link.name}: ${c.name} plugs into the cage itself, so ${gb.name} ${link.to.ports} takes no optic` });
        continue;
      }
    }
    const speedErr = linkSpeedProblem(link, ga, gb, hw);
    const oriented = orientLinkCable(lib, v, link, c, hw);
    if (oriented.problem && oriented.problem !== speedErr) problems.push({ message: oriented.problem });
  }
  return problems;
}

/** Cables in `lib` valid for both ends of `link`, sorted alphabetically by cable name. */
export function compatibleLinkCables(
  lib: Library,
  v: VirtualTopo,
  link: VLink,
  hw: ReadonlyMap<string, GroupHardware> = topoHardware(lib, v),
): CableMedia[] {
  const byName = new Map(v.groups.map((g) => [g.name, g]));
  const ga = byName.get(link.from.group);
  const gb = byName.get(link.to.group);
  if (!ga || !gb || linkSpeedProblem(link, ga, gb, hw)) return [];
  return lib.cableMedia
    .items()
    .filter((c) => !orientLinkCable(lib, v, link, c, hw).problem)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Topology ports of a group under one breakout profile: a port's number picks the data port (cage), whose mode the
 * profile gives as a Rack Designer placement with that profile gets it (`resolvePort`). A cage broken out n ways
 * holds sub-ports `<port>a` … (lane letters a, b, …); unbroken (fanout 1), the plain name.
 */
function resolveGroup(lib: Library, device: DeviceDefinition, g: VGroup, profile: BreakoutProfile, data: DataPorts): Map<string, DevicePort> {
  const ports = new Map<string, DevicePort>();
  for (const names of Object.values(g.poolNames)) {
    for (const name of names) {
      const num = portNumber(name);
      const d = num && cageOf(device, data, name);
      if (!num || !d || ports.has(name)) continue;
      const port = resolvePort(lib, device, d.ref, profile);
      const m = port && parseMode(port.mode);
      if (!port || !m) continue;
      if (m.fanout > 1 ? num.lane === undefined || num.lane >= m.fanout : num.lane !== undefined) continue;
      ports.set(name, { cage: d.ref, group: d.group, mode: port.mode, fanout: m.fanout, speedGbps: m.speedGbps });
    }
  }
  return ports;
}

/**
 * A profile that gives a group's ports; how many cages the group uses it leaves unset (native defaults), and how
 * many it fits a module in that no port of the group uses.
 */
interface Fit { profile: BreakoutProfile; ports: Map<string, DevicePort>; unset: number; spare: number }

/** What the group's ports need that a profile does not give (undefined: it gives them all). */
function misfit(lib: Library, g: VGroup, ports: Map<string, DevicePort>): string | undefined {
  for (const names of Object.values(g.poolNames)) {
    const p = names.find((n) => !ports.has(n));
    if (p !== undefined) return `no port ${p}`;
  }
  // A pool's optic carries its cages' mode: an 800G module runs 2x400G or 8x100G, a 400G module 1x400G or 1x200G.
  for (const [pool, id] of Object.entries(g.poolOptics)) {
    const o = lib.optics.get(id);
    const off = o && (g.poolNames[pool] ?? []).map((n) => ports.get(n)!).find((p) => modeTotalGbps(p.mode) > o.speedGbps);
    if (o && off) return `${pool} has ${formatGbps(o.speedGbps)} optics, ${off.cage} runs ${off.mode}`;
  }
  return undefined;
}

/**
 * How closely a fitting profile is the group's configuration: used cages it leaves at native defaults (no setting
 * for the cage or its port group), and cages it fits a module in (an optic, or a direct-attach reach) the group
 * does not use.
 */
function closeness(lib: Library, device: DeviceDefinition, profile: BreakoutProfile, data: DataPorts, ports: Map<string, DevicePort>): Pick<Fit, 'unset' | 'spare'> {
  const busy = new Map([...ports.values()].map((p) => [p.cage, p.group]));
  let unset = 0;
  for (const [ref, group] of busy) if (!profile.overrides[ref] && !profile.groupDefaults[group.id]) unset++;
  let spare = 0;
  for (const { ref } of data) {
    if (busy.has(ref)) continue;
    const r = resolvePort(lib, device, ref, profile);
    if (r && (r.optic || directAttachType(r.reach))) spare++;
  }
  return { unset, spare };
}

/** Speeds of a pool's ports on the device type (empty without one). */
export function poolSpeeds(g: VGroup, hw: Pick<GroupHardware, 'ports'>, pool: string): number[] {
  return [...new Set((g.poolNames[pool] ?? []).map((p) => hw.ports.get(p)?.speedGbps).filter((s): s is number => s !== undefined))];
}

/**
 * One fit per group so that both ends of every link run one speed (depth-first in group order, each group's fits in
 * preference order). No such choice: every group takes its first fit, and the link check reports the speeds.
 */
function chooseFits(v: VirtualTopo, fits: Map<string, Fit[]>): Map<string, Fit> {
  const byName = new Map(v.groups.map((g) => [g.name, g]));
  const names = [...fits.keys()];
  const chosen = new Map<string, Fit>();
  const speed = (group: string, pool: string, f: Fit) => poolSpeeds(byName.get(group)!, f, pool);
  const agrees = (group: string) => v.links.every((l) => {
    if (l.from.group !== group && l.to.group !== group) return true;
    const a = chosen.get(l.from.group); const b = chosen.get(l.to.group);
    if (!a || !b) return true;
    const sa = speed(l.from.group, l.from.ports, a); const sb = speed(l.to.group, l.to.ports, b);
    return sa.length === 1 && sb.length === 1 && sa[0] === sb[0];
  });
  let steps = 0;
  const search = (i: number): boolean => {
    if (i === names.length) return true;
    for (const f of fits.get(names[i])!) {
      if (++steps > 100_000) break;
      chosen.set(names[i], f);
      if (agrees(names[i]) && search(i + 1)) return true;
    }
    chosen.delete(names[i]);
    return false;
  };
  if (!search(0)) for (const n of names) chosen.set(n, fits.get(n)![0]);
  return chosen;
}

/**
 * Every group's hardware. A pool port's number is its device port (`cageOf`), its lane letter the sub-port of the
 * cage's breakout. The topology names no breakout profile: each group runs a profile of its device type that gives
 * what its pools need — every pool port exists under the profile's modes, a pool's optic carries its cages' mode —
 * and both ends of every link run one speed (linked groups are matched together). Among profiles that fit, the one
 * leaving the fewest used cages at native defaults wins, then the one fitting the fewest modules in cages the group
 * does not use, then the device's profile order. A group no profile fits gets a problem naming, per profile, the
 * first need it misses. Optics come from the pools and cables from the links, never from the profile.
 */
export function topoHardware(lib: Library, v: VirtualTopo): Map<string, GroupHardware> {
  const out = new Map<string, GroupHardware>();
  const fits = new Map<string, Fit[]>();
  for (const g of v.groups) {
    const problems: Problem[] = [];
    const device = lib.devices.get(g.deviceType);
    if (g.deviceType && !device) problems.push({ message: `group ${g.name}: device type "${g.deviceType}" is not in the Devices module` });
    const data = device ? dataPorts(device) : [];
    problems.push(...poolOpticProblems(lib, g, device, data));
    out.set(g.name, { device, ports: new Map(), problems });
    if (!device || !Object.keys(g.poolNames).length) continue;
    const numbers = numberProblems(device, g, data);
    if (numbers.length) { problems.push(...numbers); continue; }
    const ok: Fit[] = [];
    const missed = new Map<string, string[]>();
    for (const profile of device.breakoutProfiles) {
      const ports = resolveGroup(lib, device, g, profile, data);
      const why = misfit(lib, g, ports);
      if (why === undefined) ok.push({ profile, ports, ...closeness(lib, device, profile, data, ports) });
      else missed.set(why, [...(missed.get(why) ?? []), `"${profile.name}"`]);
    }
    if (ok.length) fits.set(g.name, ok.sort((a, b) => a.unset - b.unset || a.spare - b.spare));
    else {
      const each = [...missed].map(([why, profiles]) => `${profiles.join(', ')}: ${why}`).join('; ');
      problems.push({ message: `group ${g.name}: no breakout profile of ${device.name} gives its ports (${each})` });
    }
  }
  for (const [name, f] of chooseFits(v, fits)) out.set(name, { ...out.get(name)!, profile: f.profile, ports: f.ports });
  return out;
}

/**
 * Problems that need the Devices and Optics & Cables modules: each group's hardware; link ends that run at different
 * speeds; and each link's cable validated against both ends' pools, cages, modes, and optics.
 */
export function hardwareProblems(lib: Library, v: VirtualTopo, hw = topoHardware(lib, v)): Problem[] {
  const problems = [...hw.values()].flatMap((h) => h.problems);
  const byName = new Map(v.groups.map((g) => [g.name, g]));
  for (const l of v.links) {
    const ga = byName.get(l.from.group); const gb = byName.get(l.to.group);
    const err = ga && gb ? linkSpeedProblem(l, ga, gb, hw) : undefined;
    if (err) problems.push({ message: err });
  }
  problems.push(...mediaProblems(lib, v, hw));
  return problems;
}
