import type { Library } from '../library/library';
import type { DeviceDefinition, PortGroup } from '../device/types';
import { isModeAllowed, modesOf, nativeMode, parseMode } from '../device/breakout';
import { parsePortRef } from '../device/ports';
import { pickOptic } from '../ports/optic-match';
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
  /** Topology port name -> device port. */
  ports: Map<string, DevicePort>;
  problems: Problem[];
}

/** Sub-port letter of breakout lane i (0 = a). */
const lane = (i: number) => String.fromCharCode(97 + i);

/** "x" or "x (and 3 more)". */
const firstOf = (xs: string[]) => `${xs[0]}${xs.length > 1 ? ` (and ${xs.length - 1} more)` : ''}`;

/**
 * Resolves a group's port map on its device type (Devices module). Each entry zips its topology ports with device
 * ports; the entry's mode (default: native) splits each into `fanout` sub-ports named `<port>a`, `<port>b`, …
 * (fanout 1 keeps the port name). Problems: unknown device type, device ports the type lacks, modes or optics the
 * port group does not take (an optic as the Rack Designer takes a chosen module: it fits the cage and is not faster
 * than the port), ports mapped twice, pool ports the map does not name.
 */
export function groupHardware(lib: Library, g: VGroup): GroupHardware {
  const problems: Problem[] = [];
  const ports = new Map<string, DevicePort>();
  const device = lib.devices.get(g.deviceType);
  if (g.deviceType && !device) problems.push({ message: `group ${g.name}: device type "${g.deviceType}" is not in the Devices module` });
  if (!device || !g.portMap.length) return { device, ports, problems };
  const cages = new Set<string>();
  const twice: string[] = [];
  for (const e of g.portMap) {
    const missing: string[] = [];
    const used = new Set<PortGroup>();
    e.devicePorts.forEach((ref, i) => {
      const r = parsePortRef(ref);
      const pg = r && device.ports.find((p) => p.id === r.groupId);
      if (!r || !pg || r.index < 1 || r.index > pg.count) { missing.push(ref); return; }
      used.add(pg);
      // A mode the group does not take is reported once below; its sub-ports still resolve, so pools do not repeat it.
      const m = parseMode(e.mode ?? nativeMode(pg));
      const name = e.ports[i];
      if (!m || name === undefined) return;
      if (cages.has(ref)) twice.push(ref);
      cages.add(ref);
      for (let k = 0; k < m.fanout; k++) {
        const sub = m.fanout > 1 ? `${name}${lane(k)}` : name;
        if (ports.has(sub)) twice.push(sub);
        ports.set(sub, { cage: ref, speedGbps: m.speedGbps, ...(e.optic ? { opticId: e.optic } : {}) });
      }
    });
    if (missing.length) problems.push({ message: `group ${g.name}: ${device.name} has no port ${firstOf(missing)}` });
    for (const pg of used) {
      const mode = e.mode ?? nativeMode(pg);
      if (!isModeAllowed(pg, mode)) {
        problems.push({ message: `group ${g.name}: ${pg.label} ports have no mode ${mode} (${modesOf(pg).join(', ')})` });
        continue;
      }
      if (!e.optic) continue;
      const o = lib.optics.get(e.optic);
      if (!o) problems.push({ message: `group ${g.name}: optic "${e.optic}" is not in the Optics module` });
      else if (pickOptic(lib, pg, mode, undefined, o.id)?.id !== o.id) problems.push({ message: `group ${g.name}: ${o.name} does not fit ${pg.label} ports` });
    }
  }
  if (twice.length) problems.push({ message: `group ${g.name}: port_map maps ${firstOf(twice)} twice` });
  for (const [pool, names] of Object.entries(g.poolNames)) {
    const unmapped = names.filter((p) => !ports.has(p));
    if (unmapped.length) problems.push({ message: `group ${g.name}: pool ${pool} port ${firstOf(unmapped)} is not in the port map` });
  }
  return { device, ports, problems };
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

