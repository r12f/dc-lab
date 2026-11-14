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
  const ff = String(g.formFactor ?? g.connector ?? '');
  if (/console/.test(text)) return 'console';
  if (/mgmt|bmc|management/.test(text)) return 'mgmt';
  if (/^c1[3-9]|^c2/i.test(ff)) return 'outlet';
  return 'data';
}

function toSetting(v: unknown): unknown {
  return typeof v === 'string' ? { mode: v } : v;
}

function mapValues(obj: unknown, fn: (v: unknown) => unknown): Json {
  return Object.fromEntries(Object.entries((obj as Json) ?? {}).map(([k, v]) => [k, fn(v)]));
}

function migrateGroup(g: Json): Json {
  const { connector, ...rest } = g;
  return { ...rest, formFactor: g.formFactor ?? connector, role: g.role ?? inferRole(g) };
}

export function migrateDevice(d: Json): Json {
  const ports = ((d.ports as Json[]) ?? []).map(migrateGroup);
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

/** Old `sidePods: { left, right }` slot counts -> one sidepod element per side holding those slots. */
export function migrateRack(r: Json): Json {
  if (Array.isArray(r.sideElements)) return r;
  const pods = (r.sidePods as { left?: number; right?: number }) ?? {};
  const sideElements = (['left', 'right'] as const)
    .filter((side) => (pods[side] ?? 0) > 0)
    .map((side) => ({
      id: `sidepod-${side}`, name: `Sidepod ${side === 'left' ? 'L' : 'R'}`, kind: 'sidepod', side,
      widthMm: 100, depthMm: Number(r.depthMm ?? 1200), slots: pods[side], weightKg: 0,
    }));
  const { sidePods: _s, ...rest } = r;
  void _s;
  return { ...rest, sideElements };
}

/** Old side mounts `{ side, slot }` -> `{ elementId: "sidepod-<side>", slot }`. */
function migrateSideMount(p: Json): Json {
  const m = p.mount as Json | undefined;
  if (m?.kind !== 'side' || m.elementId) return p;
  return { ...p, mount: { kind: 'side', elementId: `sidepod-${String(m.side)}`, slot: m.slot } };
}

/** Optic `connector`/`media` -> `formFactor`/`reach` (+ fiber connector guessed from the reach). */
export function migrateOptic(o: Json): Json {
  if (o.formFactor) return o;
  const { connector, media, ...rest } = o;
  const reach = String(media ?? '');
  const fiber = /SR|DR|PSM/i.test(reach) ? 'MPO-12' : /FR|LR|ER/i.test(reach) ? 'LC' : '';
  const n = /^(\d+)x/i.exec(reach)?.[1];
  return { ...rest, formFactor: connector, reach, fiberConnector: n && fiber ? `${n}x ${fiber}` : fiber };
}

export function migrateProjectJson(p: Json): Json {
  return {
    ...p,
    optics: ((p.optics as Json[]) ?? []).map(migrateOptic),
    devices: ((p.devices as Json[]) ?? []).map(migrateDevice),
    racks: ((p.racks as Json[]) ?? []).map(migrateRack),
    rackDesigns: ((p.rackDesigns as Json[]) ?? []).map((d) => ({
      ...d,
      placements: ((d.placements as Json[]) ?? []).map(migratePlacement).map(migrateSideMount),
    })),
    hiddenBuiltins: p.hiddenBuiltins ?? [],
  };
}
