import type { PortRole } from '../device/types';

/**
 * Upgrades older in-file shapes to the current model, in place on a plain-JSON copy.
 * - profile settings stored as plain mode strings -> { mode }
 * - port groups without `role` -> inferred from connector/label
 * - placement `portConfig`/`groupOptics` -> `portSettings`/`groupSettings`
 */
type Json = Record<string, unknown>;

function inferRole(g: Json): PortRole {
  const text = `${String(g.label ?? '')} ${String(g.id ?? '')}`.toLowerCase();
  if (/console/.test(text)) return 'console';
  if (/mgmt|bmc|management/.test(text)) return 'mgmt';
  if (/^c1[3-9]|^c2/i.test(String(g.connector ?? ''))) return 'outlet';
  return 'data';
}

function toSetting(v: unknown): unknown {
  return typeof v === 'string' ? { mode: v } : v;
}

function mapValues(obj: unknown, fn: (v: unknown) => unknown): Json {
  return Object.fromEntries(Object.entries((obj as Json) ?? {}).map(([k, v]) => [k, fn(v)]));
}

export function migrateDevice(d: Json): Json {
  const ports = ((d.ports as Json[]) ?? []).map((g) => ({ ...g, role: g.role ?? inferRole(g) }));
  const breakoutProfiles = ((d.breakoutProfiles as Json[]) ?? []).map((p) => ({
    ...p,
    groupDefaults: mapValues(p.groupDefaults, toSetting),
    overrides: mapValues(p.overrides, toSetting),
  }));
  return { ...d, ports, breakoutProfiles };
}

export function migratePlacement(p: Json): Json {
  if (p.portSettings && p.groupSettings) return p;
  const portSettings = mapValues(p.portConfig, (v) => {
    const c = v as Json;
    return Object.fromEntries(Object.entries({ mode: c.breakout, opticId: c.opticId }).filter(([, x]) => x !== undefined));
  });
  const groupSettings = mapValues(p.groupOptics, (v) => ({ opticId: v }));
  const { portConfig: _a, groupOptics: _b, ...rest } = p;
  void _a; void _b;
  return { ...rest, portSettings, groupSettings };
}

export function migrateProjectJson(p: Json): Json {
  return {
    ...p,
    devices: ((p.devices as Json[]) ?? []).map(migrateDevice),
    rackDesigns: ((p.rackDesigns as Json[]) ?? []).map((d) => ({
      ...d,
      placements: ((d.placements as Json[]) ?? []).map(migratePlacement),
    })),
    hiddenBuiltins: p.hiddenBuiltins ?? [],
  };
}
