import type { Library } from '../library/library';
import type { BreakoutProfile, DeviceDefinition, PortGroup } from '../device/types';
import { parseMode } from '../device/breakout';
import { resolvePort } from '../device/port-settings';
import { compatibleCables, directAttachType, modeTotalGbps, opticFitsCage } from '../ports/optic-match';
import { heatSinkOf, moduleFits } from '../ports/form-factors';
import { isDirectAttach } from '../optics/cable-types';
import { formatGbps } from '../units';
import { portNumber, type Problem, type VGroup, type VirtualTopo } from './virtual';

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

/** Optics and cables set on the pools: known, fitting the cages, and a cable that fits the optic (or the cage). */
function mediaProblems(lib: Library, g: VGroup, device: DeviceDefinition | undefined, data: DataPorts): Problem[] {
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
  for (const [pool, id] of Object.entries(g.poolCables)) {
    const c = lib.cableMedia.get(id);
    if (!c) { say(`${pool} cable "${id}" is not in Optics & Cables`); continue; }
    const o = lib.optics.get(g.poolOptics[pool]);
    if (c.type === 'power' || c.type === 'other') say(`${pool}: ${c.name} is not a data cable`);
    else if (isDirectAttach(c.type)) {
      if (g.poolOptics[pool]) say(`${pool}: ${c.name} plugs into the cage itself, so the pool takes no optic`);
      for (const cg of cages(pool)) {
        if (!moduleFits(cg.formFactor, c.ends.a.connector) && !moduleFits(cg.formFactor, c.ends.b.connector)) say(`${pool}: ${c.name} does not plug into the ${cg.formFactor} cages`);
      }
    } else if (!g.poolOptics[pool]) say(`${pool}: ${c.name} needs an optic in the cage`);
    else if (o) {
      for (const cg of cages(pool)) if (!compatibleCables(lib, cg, o).some((x) => x.id === c.id)) say(`${pool}: ${c.name} does not fit ${o.name}`);
    }
  }
  return problems;
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
 * first need it misses. Optics and cables come from the pools, never from the profile.
 */
export function topoHardware(lib: Library, v: VirtualTopo): Map<string, GroupHardware> {
  const out = new Map<string, GroupHardware>();
  const fits = new Map<string, Fit[]>();
  for (const g of v.groups) {
    const problems: Problem[] = [];
    const device = lib.devices.get(g.deviceType);
    if (g.deviceType && !device) problems.push({ message: `group ${g.name}: device type "${g.deviceType}" is not in the Devices module` });
    const data = device ? dataPorts(device) : [];
    problems.push(...mediaProblems(lib, g, device, data));
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
 * speeds; a direct-attach cable (it joins both cages) facing an optic or another cable at the other end.
 */
export function hardwareProblems(lib: Library, v: VirtualTopo, hw = topoHardware(lib, v)): Problem[] {
  const problems = [...hw.values()].flatMap((h) => h.problems);
  const byName = new Map(v.groups.map((g) => [g.name, g]));
  const speeds = (group: string, pool: string) => {
    const g = byName.get(group); const h = hw.get(group);
    return g && h ? poolSpeeds(g, h, pool) : [];
  };
  for (const l of v.links) {
    const a = speeds(l.from.group, l.from.ports); const b = speeds(l.to.group, l.to.ports);
    if (a.length && b.length && !(a.length === 1 && b.length === 1 && a[0] === b[0])) {
      problems.push({ message: `${l.name}: ${l.from.group} ${l.from.ports} runs ${a.map(formatGbps).join('/')}, ${l.to.group} ${l.to.ports} ${b.map(formatGbps).join('/')}` });
    }
    const ends = [l.from, l.to].map((e) => {
      const g = byName.get(e.group);
      return { e, optic: g?.poolOptics[e.ports], cable: g ? lib.cableMedia.get(g.poolCables[e.ports]) : undefined };
    });
    for (const [i, end] of ends.entries()) {
      const other = ends[1 - i];
      if (!end.cable || !isDirectAttach(end.cable.type)) continue;
      if (other.optic) problems.push({ message: `${l.name}: ${end.cable.name} joins both cages, but ${other.e.group} ${other.e.ports} has an optic` });
      // Both ends direct-attach and different: said once, from the from end.
      else if (other.cable && other.cable.id !== end.cable.id && (i === 0 || !isDirectAttach(other.cable.type))) problems.push({ message: `${l.name}: ${end.cable.name} joins both cages, but ${other.e.group} ${other.e.ports} takes ${other.cable.name}` });
    }
  }
  return problems;
}
