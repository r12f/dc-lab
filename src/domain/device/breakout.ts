import type { BreakoutProfile, DeviceDefinition, PortGroup } from './types';
import { findGroup, parsePortRef } from './ports';

export interface BreakoutMode {
  fanout: number;
  speedGbps: number;
}

export function parseMode(text: string): BreakoutMode | undefined {
  const m = /^(\d+)x(\d+)G$/i.exec(text.trim());
  return m ? { fanout: Number(m[1]), speedGbps: Number(m[2]) } : undefined;
}

export function formatMode(mode: BreakoutMode): string {
  return `${mode.fanout}x${mode.speedGbps}G`;
}

export function nativeMode(group: PortGroup): string {
  return formatMode({ fanout: 1, speedGbps: group.speedGbps });
}

/** Native mode first, then the group's declared modes (deduplicated). */
export function modesOf(group: PortGroup): string[] {
  return [...new Set([nativeMode(group), ...group.breakoutModes])];
}

/** True when the mode is syntactically valid and fits the port's native bandwidth. */
export function isModeFeasible(group: PortGroup, mode: string): boolean {
  const m = parseMode(mode);
  return !!m && m.fanout >= 1 && m.fanout * m.speedGbps <= group.speedGbps;
}

export function isModeAllowed(group: PortGroup, mode: string): boolean {
  return modesOf(group).includes(mode) && isModeFeasible(group, mode);
}

export function findProfile(device: DeviceDefinition, id?: string): BreakoutProfile | undefined {
  return id ? device.breakoutProfiles.find((p) => p.id === id) : undefined;
}

/**
 * Effective breakout mode for one port, resolved in priority order:
 * instance override > profile override > profile group default > native.
 */
export function effectiveMode(
  device: DeviceDefinition,
  portRef: string,
  profile?: BreakoutProfile,
  instanceOverride?: string,
): string {
  const ref = parsePortRef(portRef);
  const group = ref && findGroup(device, ref.groupId);
  if (!group) return '';
  const candidates = [instanceOverride, profile?.overrides[portRef], profile?.groupDefaults[group.id]];
  return candidates.find((m): m is string => !!m && isModeAllowed(group, m)) ?? nativeMode(group);
}

/** Problems with a profile against its device. */
export function validateProfile(device: DeviceDefinition, profile: BreakoutProfile): string[] {
  const errors: string[] = [];
  for (const [groupId, mode] of Object.entries(profile.groupDefaults)) {
    const g = findGroup(device, groupId);
    if (!g) errors.push(`Unknown port group "${groupId}"`);
    else if (!isModeAllowed(g, mode)) errors.push(`${mode} not allowed on ${g.label}`);
  }
  for (const [portRef, mode] of Object.entries(profile.overrides)) {
    const ref = parsePortRef(portRef);
    const g = ref && findGroup(device, ref.groupId);
    if (!g || !ref || ref.index < 1 || ref.index > g.count) errors.push(`Unknown port "${portRef}"`);
    else if (!isModeAllowed(g, mode)) errors.push(`${mode} not allowed on ${portRef}`);
  }
  return errors;
}
