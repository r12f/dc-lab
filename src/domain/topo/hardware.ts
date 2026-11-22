import type { Library } from '../library/library';
import type { BreakoutProfile, DeviceDefinition } from '../device/types';
import { parseMode } from '../device/breakout';
import { parsePortRef } from '../device/ports';
import { resolvePort } from '../device/port-settings';
import { directAttachType } from '../ports/optic-match';
import { formatGbps } from '../units';
import { portUse } from './ports';
import type { Problem, VGroup, VirtualTopo } from './virtual';

/** A topology port on its device type: the device port (cage) it sits in, its speed and what is plugged in. */
export interface DevicePort {
  /** Device port, `<port group id>/<index>`. */
  cage: string;
  speedGbps: number;
  opticId?: string;
  /** An optic or a direct-attach cable (DAC / AEC / AOC) is in the cage, so a link can use the port. */
  module: boolean;
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

/** Sub-port letter of breakout lane i (0 = a). */
const lane = (i: number) => String.fromCharCode(97 + i);

/** "x" or "x (and 3 more)". */
const firstOf = (xs: string[]) => `${xs[0]}${xs.length > 1 ? ` (and ${xs.length - 1} more)` : ''}`;

/** The device type has this port (`<port group id>/<index>`). */
function hasPort(device: DeviceDefinition, ref: string): boolean {
  const r = parsePortRef(ref);
  const pg = r && device.ports.find((p) => p.id === r.groupId);
  return !!r && !!pg && r.index >= 1 && r.index <= pg.count;
}

/** Port map problems that hold under any profile: device ports the type lacks, ports mapped twice. */
function mapProblems(device: DeviceDefinition, g: VGroup): Problem[] {
  const missing: string[] = [];
  const twice: string[] = [];
  const seen = new Set<string>();
  const once = (x: string) => { if (seen.has(x)) twice.push(x); seen.add(x); };
  for (const e of g.portMap) {
    e.devicePorts.forEach((ref, i) => {
      if (!hasPort(device, ref)) { missing.push(ref); return; }
      once(ref);
      if (e.ports[i] !== undefined) once(e.ports[i]);
    });
  }
  const problems: Problem[] = [];
  if (missing.length) problems.push({ message: `group ${g.name}: ${device.name} has no port ${firstOf(missing)}` });
  if (twice.length) problems.push({ message: `group ${g.name}: port_map maps ${firstOf(twice)} twice` });
  return problems;
}

/**
 * Topology ports of a group under one breakout profile: each port map entry zips topology ports with device ports,
 * and the profile gives each device port its mode and module, as a Rack Designer placement with that profile gets
 * them (`resolvePort`). A port broken out n ways gives sub-ports `<port>a`, `<port>b`, …; fanout 1 keeps the name.
 */
function resolveGroup(lib: Library, device: DeviceDefinition, g: VGroup, profile: BreakoutProfile): Map<string, DevicePort> {
  const ports = new Map<string, DevicePort>();
  for (const e of g.portMap) {
    e.devicePorts.forEach((ref, i) => {
      const port = hasPort(device, ref) ? resolvePort(lib, device, ref, profile) : undefined;
      const m = port && parseMode(port.mode);
      const name = e.ports[i];
      if (!port || !m || name === undefined) return;
      const module = !!port.optic || !!directAttachType(port.reach);
      for (let k = 0; k < m.fanout; k++) {
        const sub = m.fanout > 1 ? `${name}${lane(k)}` : name;
        if (!ports.has(sub)) ports.set(sub, { cage: ref, speedGbps: m.speedGbps, ...(port.optic ? { opticId: port.optic.id } : {}), module });
      }
    });
  }
  return ports;
}

/** A profile that gives a group's ports, and how many cages it fits a module in that no used port needs. */
interface Fit { profile: BreakoutProfile; ports: Map<string, DevicePort>; spare: number }

/** What the group's ports need that a profile does not give (undefined: it gives them all). */
function misfit(g: VGroup, used: ReadonlySet<string>, ports: Map<string, DevicePort>): string | undefined {
  for (const names of Object.values(g.poolNames)) {
    const p = names.find((n) => !ports.has(n));
    if (p !== undefined) return `no port ${p}`;
  }
  for (const p of used) if (!ports.get(p)?.module) return `${p} has no optic or cable`;
  return undefined;
}

function spareCages(ports: Map<string, DevicePort>, used: ReadonlySet<string>): number {
  const fitted = new Set<string>();
  const busy = new Set<string>();
  for (const [name, p] of ports) {
    if (p.module) fitted.add(p.cage);
    if (used.has(name)) busy.add(p.cage);
  }
  return [...fitted].filter((c) => !busy.has(c)).length;
}

/** Speeds of a pool's ports on the device type (empty without a port map). */
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
 * Every group's hardware. The topology names no breakout profile: each group runs a profile of its device type that
 * gives what its ports need — every pool port exists, every port a link uses has an optic or a direct-attach cable,
 * and both ends of every link run one speed (linked groups are matched together). Among profiles that fit, the one
 * fitting the fewest modules in cages no used port needs wins, then the device's profile order. A group no profile
 * fits gets a problem naming, per profile, the first need it misses.
 */
export function topoHardware(lib: Library, v: VirtualTopo): Map<string, GroupHardware> {
  const out = new Map<string, GroupHardware>();
  const fits = new Map<string, Fit[]>();
  for (const g of v.groups) {
    const problems: Problem[] = [];
    const device = lib.devices.get(g.deviceType);
    if (g.deviceType && !device) problems.push({ message: `group ${g.name}: device type "${g.deviceType}" is not in the Devices module` });
    out.set(g.name, { device, ports: new Map(), problems });
    if (!device || !g.portMap.length) continue;
    problems.push(...mapProblems(device, g));
    const used = new Set(portUse(g, v).owner.keys());
    const ok: Fit[] = [];
    const missed = new Map<string, string[]>();
    for (const profile of device.breakoutProfiles) {
      const ports = resolveGroup(lib, device, g, profile);
      const why = misfit(g, used, ports);
      if (why === undefined) ok.push({ profile, ports, spare: spareCages(ports, used) });
      else missed.set(why, [...(missed.get(why) ?? []), `"${profile.name}"`]);
    }
    if (ok.length) fits.set(g.name, ok.sort((a, b) => a.spare - b.spare));
    else {
      const each = [...missed].map(([why, profiles]) => `${profiles.join(', ')}: ${why}`).join('; ');
      problems.push({ message: `group ${g.name}: no breakout profile of ${device.name} gives its ports (${each})` });
    }
  }
  for (const [name, f] of chooseFits(v, fits)) out.set(name, { ...out.get(name)!, profile: f.profile, ports: f.ports });
  return out;
}

/** Problems that need the Devices module: each group's hardware, and link ends that run at different speeds. */
export function hardwareProblems(lib: Library, v: VirtualTopo, hw = topoHardware(lib, v)): Problem[] {
  const problems = [...hw.values()].flatMap((h) => h.problems);
  const byName = new Map(v.groups.map((g) => [g.name, g]));
  const speeds = (group: string, pool: string) => {
    const g = byName.get(group); const h = hw.get(group);
    return g && h ? poolSpeeds(g, h, pool) : [];
  };
  for (const l of v.links) {
    const a = speeds(l.from.group, l.from.ports); const b = speeds(l.to.group, l.to.ports);
    if (!a.length || !b.length || (a.length === 1 && b.length === 1 && a[0] === b[0])) continue;
    problems.push({ message: `${l.name}: ${l.from.group} ${l.from.ports} runs ${a.map(formatGbps).join('/')}, ${l.to.group} ${l.to.ports} ${b.map(formatGbps).join('/')}` });
  }
  return problems;
}
