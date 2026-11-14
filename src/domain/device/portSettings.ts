import type { BreakoutProfile, DeviceDefinition, PortGroup, PortSetting } from './types';
import { findGroup, parsePortRef } from './ports';
import { isModeAllowed, nativeMode } from './breakout';

export interface ResolvedPort {
  group: PortGroup;
  mode: string;
  opticId?: string;
  cableId?: string;
}

/** Instance-level settings (Rack Designer placement) layered over the profile. */
export interface InstanceSettings {
  port?: PortSetting;
  group?: PortSetting;
}

function pick<K extends keyof PortSetting>(layers: (PortSetting | undefined)[], key: K): PortSetting[K] | undefined {
  for (const l of layers) if (l && l[key] !== undefined) return l[key];
  return undefined;
}

/**
 * Resolves the effective setting of one port. Each field resolves independently:
 * instance port > instance group > profile port > profile group > native / none.
 * An empty-string optic/cable id means "explicitly none".
 */
export function resolvePort(
  device: DeviceDefinition,
  portRef: string,
  profile?: BreakoutProfile,
  instance?: InstanceSettings,
): ResolvedPort | undefined {
  const ref = parsePortRef(portRef);
  const group = ref && findGroup(device, ref.groupId);
  if (!group) return undefined;
  const layers = [instance?.port, instance?.group, profile?.overrides[portRef], profile?.groupDefaults[group.id]];
  const mode = layers.map((l) => l?.mode).find((m): m is string => !!m && isModeAllowed(group, m));
  return {
    group,
    mode: mode ?? nativeMode(group),
    opticId: pick(layers, 'opticId') || undefined,
    cableId: pick(layers, 'cableId') || undefined,
  };
}

/** Returns `map` with `key` set to `setting`, or removed when the setting is empty. */
export function withSetting(map: Record<string, PortSetting>, key: string, setting: PortSetting): Record<string, PortSetting> {
  const cleaned = Object.fromEntries(Object.entries(setting).filter(([, v]) => v !== undefined)) as PortSetting;
  const next = { ...map };
  if (Object.keys(cleaned).length === 0) delete next[key];
  else next[key] = cleaned;
  return next;
}
