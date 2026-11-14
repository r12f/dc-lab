import type { BreakoutProfile, DeviceDefinition, PortGroup } from './types';
import { findGroup, parsePortRef } from './ports';
import { acceptedModules, formFactorSpec } from '../ports/formFactors';

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

/** Native speed of each backward-compatible module form factor below the cage's own speed. */
function compatModes(group: PortGroup): string[] {
  return acceptedModules(group.formFactor)
    .slice(1)
    .map((f) => formFactorSpec(f).nativeGbps)
    .filter((g): g is number => !!g && g < group.speedGbps)
    .map((g) => formatMode({ fanout: 1, speedGbps: g }));
}

/** Native mode first, then declared breakout modes, then speeds of compatible older modules. */
export function modesOf(group: PortGroup): string[] {
  return [...new Set([nativeMode(group), ...group.breakoutModes, ...compatModes(group)])];
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

/** Effective breakout mode of one port (see resolvePort for the priority order). */
export function effectiveMode(
  device: DeviceDefinition,
  portRef: string,
  profile?: BreakoutProfile,
  instanceOverride?: string,
): string {
  const ref = parsePortRef(portRef);
  const group = ref && findGroup(device, ref.groupId);
  if (!group) return '';
  const candidates = [instanceOverride, profile?.overrides[portRef]?.mode, profile?.groupDefaults[group.id]?.mode];
  return candidates.find((m): m is string => !!m && isModeAllowed(group, m)) ?? nativeMode(group);
}

/** Problems with a profile against its device. */
export function validateProfile(device: DeviceDefinition, profile: BreakoutProfile): string[] {
  const errors: string[] = [];
  for (const [groupId, setting] of Object.entries(profile.groupDefaults)) {
    const g = findGroup(device, groupId);
    if (!g) errors.push(`Unknown port group "${groupId}"`);
    else if (setting.mode && !isModeAllowed(g, setting.mode)) errors.push(`${setting.mode} not allowed on ${g.label}`);
  }
  for (const [portRef, setting] of Object.entries(profile.overrides)) {
    const ref = parsePortRef(portRef);
    const g = ref && findGroup(device, ref.groupId);
    if (!g || !ref || ref.index < 1 || ref.index > g.count) errors.push(`Unknown port "${portRef}"`);
    else if (setting.mode && !isModeAllowed(g, setting.mode)) errors.push(`${setting.mode} not allowed on ${portRef}`);
  }
  return errors;
}
