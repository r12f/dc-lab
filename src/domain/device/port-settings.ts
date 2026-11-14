import type { BreakoutProfile, DeviceDefinition, PortGroup, PortSetting } from './types';
import type { Library } from '../library/library';
import type { OpticDefinition } from '../optics/types';
import { findGroup, parsePortRef } from './ports';
import { isModeAllowed, nativeMode } from './breakout';
import { isEnginePort, pickOptic } from '../ports/optic-match';

export interface ResolvedPort {
  group: PortGroup;
  mode: string;
  /** Reach class in use (from the setting, or from the pinned module). */
  reach?: string;
  /** Module plugged in (cages only): pinned, or auto-picked from speed + reach. */
  optic?: OpticDefinition;
  /** True when `optic` was auto-picked rather than pinned. */
  autoOptic: boolean;
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
 * An empty string means "explicitly none". The module is pinned (`opticId`) or auto-picked
 * from cage + speed + reach.
 */
export function resolvePort(
  lib: Library,
  device: DeviceDefinition,
  portRef: string,
  profile?: BreakoutProfile,
  instance?: InstanceSettings,
): ResolvedPort | undefined {
  const ref = parsePortRef(portRef);
  const group = ref && findGroup(device, ref.groupId);
  if (!group) return undefined;
  const layers = [instance?.port, instance?.group, profile?.overrides[portRef], profile?.groupDefaults[group.id]];
  const mode = layers.map((l) => l?.mode).find((m): m is string => !!m && isModeAllowed(group, m)) ?? nativeMode(group);
  const reach = pick(layers, 'reach') || undefined;
  const opticId = pick(layers, 'opticId') || undefined;
  const optic = isEnginePort(group) ? undefined : pickOptic(lib, group, mode, reach, opticId);
  return {
    group,
    mode,
    reach: group.role === 'laser' ? undefined : reach ?? optic?.reach,
    optic,
    autoOptic: !!optic && optic.id !== opticId,
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
