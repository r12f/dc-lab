import type { Library } from '../library/library';
import type { BreakoutProfile, DeviceDefinition } from '../device/types';
import { findProfile, parseMode, validateProfile } from '../device/breakout';
import { parsePortRef } from '../device/ports';
import { resolvePort } from '../device/port-settings';
import { formatGbps } from '../units';
import type { Problem, VGroup, VirtualTopo } from './virtual';

/** A topology port on its device type: the device port (cage) it sits in, its speed and the optic in that cage. */
export interface DevicePort {
  /** Device port, `<port group id>/<index>`. */
  cage: string;
  speedGbps: number;
  opticId?: string;
}

/** A group's members as their device type: every topology port its port map names, resolved. */
export interface GroupHardware {
  device?: DeviceDefinition;
  /** Breakout profile the members run: the one the group names, else the device type's default. */
  profile?: BreakoutProfile;
  /** Topology port name -> device port. */
  ports: Map<string, DevicePort>;
  problems: Problem[];
}

/** Sub-port letter of breakout lane i (0 = a). */
const lane = (i: number) => String.fromCharCode(97 + i);

/** "x" or "x (and 3 more)". */
const firstOf = (xs: string[]) => `${xs[0]}${xs.length > 1 ? ` (and ${xs.length - 1} more)` : ''}`;

/** The group's breakout profile: by id, else by name (unique); a group naming none runs the device's default. */
function groupProfile(device: DeviceDefinition, g: VGroup, problems: Problem[]): BreakoutProfile | undefined {
  const ref = g.breakoutProfile;
  if (!ref) return findProfile(device);
  const byId = device.breakoutProfiles.find((p) => p.id === ref);
  if (byId) return byId;
  const byName = device.breakoutProfiles.filter((p) => p.name === ref);
  if (byName.length === 1) return byName[0];
  problems.push({ message: byName.length
    ? `group ${g.name}: ${device.name} has ${byName.length} breakout profiles named "${ref}"`
    : `group ${g.name}: ${device.name} has no breakout profile "${ref}" (${device.breakoutProfiles.map((p) => p.name).join(', ')})` });
  return undefined;
}

/**
 * Resolves a group's port map on its device type (Devices module). Each entry zips its topology ports with device
 * ports; the breakout profile gives each device port its mode and optic, as a Rack Designer placement with that
 * profile gets them (`resolvePort`). A port broken out n ways gives sub-ports `<port>a`, `<port>b`, … (fanout 1 keeps
 * the port name). Problems: unknown device type or profile, an invalid profile, device ports the type lacks, ports
 * mapped twice, pool ports the map and profile do not give.
 */
export function groupHardware(lib: Library, g: VGroup): GroupHardware {
  const problems: Problem[] = [];
  const ports = new Map<string, DevicePort>();
  const device = lib.devices.get(g.deviceType);
  if (g.deviceType && !device) problems.push({ message: `group ${g.name}: device type "${g.deviceType}" is not in the Devices module` });
  if (!device) return { ports, problems };
  const profile = groupProfile(device, g, problems);
  if (g.breakoutProfile && !profile) return { device, ports, problems };
  if (profile) for (const e of validateProfile(device, profile)) problems.push({ message: `group ${g.name}: breakout profile "${profile.name}": ${e}` });
  if (!g.portMap.length) return { device, profile, ports, problems };
  const cages = new Set<string>();
  const twice: string[] = [];
  for (const e of g.portMap) {
    const missing: string[] = [];
    e.devicePorts.forEach((ref, i) => {
      const r = parsePortRef(ref);
      const pg = r && device.ports.find((p) => p.id === r.groupId);
      const port = pg && r.index >= 1 && r.index <= pg.count ? resolvePort(lib, device, ref, profile) : undefined;
      if (!port) { missing.push(ref); return; }
      const m = parseMode(port.mode);
      const name = e.ports[i];
      if (!m || name === undefined) return;
      if (cages.has(ref)) twice.push(ref);
      cages.add(ref);
      for (let k = 0; k < m.fanout; k++) {
        const sub = m.fanout > 1 ? `${name}${lane(k)}` : name;
        if (ports.has(sub)) twice.push(sub);
        ports.set(sub, { cage: ref, speedGbps: m.speedGbps, ...(port.optic ? { opticId: port.optic.id } : {}) });
      }
    });
    if (missing.length) problems.push({ message: `group ${g.name}: ${device.name} has no port ${firstOf(missing)}` });
  }
  if (twice.length) problems.push({ message: `group ${g.name}: port_map maps ${firstOf(twice)} twice` });
  const via = profile ? `port_map, breakout profile "${profile.name}"` : 'port_map';
  for (const [pool, names] of Object.entries(g.poolNames)) {
    const unmapped = names.filter((p) => !ports.has(p));
    if (unmapped.length) problems.push({ message: `group ${g.name}: pool ${pool} port ${firstOf(unmapped)} is not a device port (${via})` });
  }
  return { device, profile, ports, problems };
}

/** Speeds of a pool's ports on the device type (empty without a port map). */
export function poolSpeeds(g: VGroup, hw: GroupHardware, pool: string): number[] {
  return [...new Set((g.poolNames[pool] ?? []).map((p) => hw.ports.get(p)?.speedGbps).filter((s): s is number => s !== undefined))];
}

/** Problems that need the Devices / Optics modules: each group's hardware, and link ends that run at different speeds. */
export function hardwareProblems(lib: Library, v: VirtualTopo): Problem[] {
  const hw = new Map(v.groups.map((g) => [g.name, groupHardware(lib, g)]));
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
