import { abbrFromName, cleanAbbr } from '../design/abbr';
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

/** Built-in DAC "optics" became direct-attach cables: optic id -> cable id. */
const DAC_OPTIC_TO_CABLE: Record<string, string> = { 'osfp-800g-dac': 'dac-800g', 'qsfp28-100g-dac': 'dac-100g' };

/** A port setting that pinned a DAC "optic" now sets reach DAC and the DAC cable instead. */
function migrateDacSetting(s: Json): Json {
  const cable = DAC_OPTIC_TO_CABLE[String(s.opticId)];
  if (!cable) return s;
  const { opticId: _o, ...rest } = s;
  void _o;
  return { ...rest, reach: 'DAC', cableId: rest.cableId ?? cable };
}

function toSetting(v: unknown): unknown {
  return migrateDacSetting((typeof v === 'string' ? { mode: v } : v) as Json);
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
  if (p.portSettings && p.groupSettings) {
    return { ...p, portSettings: mapValues(p.portSettings, toSetting), groupSettings: mapValues(p.groupSettings, toSetting) };
  }
  const portSettings = mapValues(p.portConfig, (v) => {
    const c = v as Json;
    return migrateDacSetting(Object.fromEntries(Object.entries({ mode: c.breakout, opticId: c.opticId }).filter(([, x]) => x !== undefined)));
  });
  const groupSettings = mapValues(p.groupOptics, (v) => migrateDacSetting({ opticId: v }));
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
  if (o.formFactor) return o.packaging ? o : { ...o, packaging: 'module' };
  const { connector, media, ...rest } = o;
  const reach = String(media ?? '');
  const fiber = /SR|DR|PSM/i.test(reach) ? 'MPO-12' : /FR|LR|ER/i.test(reach) ? 'LC' : '';
  const n = /^(\d+)x/i.exec(reach)?.[1];
  return { ...rest, packaging: 'module', formFactor: connector, reach, fiberConnector: n && fiber ? `${n}x ${fiber}` : fiber };
}

/**
 * Old layouts had horizontal rows (`frontFacing` north/south). Rotate the whole plan 90° so rows run
 * north–south: (x, y) -> (y, x), rectangles swap width/depth, room swaps dimensions.
 */
function rotateLayout(l: Json): Json {
  const rows = (l.rows as Json[]) ?? [];
  const horizontal = rows.some((r) => r.frontFacing === 'north' || r.frontFacing === 'south');
  if (!horizontal) return l;
  const swapRect = (r: Json) => ({ ...r, x: r.y, y: r.x, widthMm: r.depthMm, depthMm: r.widthMm });
  const room = l.room as Json | undefined;
  return {
    ...l,
    room: room && { widthMm: room.depthMm, depthMm: room.widthMm },
    rows: rows.map((r) => ({ ...r, x: r.y, y: r.x, frontFacing: r.frontFacing === 'north' ? 'west' : 'east' })),
    aisles: ((l.aisles as Json[]) ?? []).map(swapRect),
    trays: ((l.trays as Json[]) ?? []).map(swapRect),
  };
}

/**
 * Free-positioned rows/aisles/trays -> rack area + west-to-east sequence; trays attach to the aisle
 * nearest their centre. The rack area is the bounding box of the old rows and aisles.
 */
function sequenceLayout(l: Json): Json {
  if (Array.isArray(l.sequence)) return l;
  const num = (v: unknown) => Number(v ?? 0);
  const rows = (l.rows as Json[]) ?? [];
  const aisles = (l.aisles as Json[]) ?? [];
  const rowRect = (r: Json) => ({ x: num(r.x), y: num(r.y), w: num(r.tileDepthMm ?? 1200), d: num(r.tileCount ?? 20) * num(r.tileWidthMm ?? 600) });
  const aisleRect = (a: Json) => ({ x: num(a.x), y: num(a.y), w: num(a.widthMm ?? 1200), d: num(a.depthMm) });
  const rects = [...rows.map(rowRect), ...aisles.map(aisleRect)];
  const room = (l.room as Json | undefined) ?? { widthMm: 20000, depthMm: 16000 };
  const whitespace = rects.length
    ? (() => {
      const x = Math.min(...rects.map((r) => r.x)), y = Math.min(...rects.map((r) => r.y));
      return { x, y, widthMm: Math.max(...rects.map((r) => r.x + r.w)) - x, depthMm: Math.max(...rects.map((r) => r.y + r.d)) - y };
    })()
    : { x: 3000, y: 2000, widthMm: Math.max(1000, num(room.widthMm) - 6000), depthMm: Math.max(1000, num(room.depthMm) - 4000) };
  const sequence = [...rows.map((r) => ({ id: r.id, x: num(r.x) })), ...aisles.map((a) => ({ id: a.id, x: num(a.x) }))]
    .sort((a, b) => a.x - b.x).map((e) => e.id);
  const aisleCenter = (a: Json) => num(a.x) + num(a.widthMm) / 2;
  return {
    ...l,
    whitespace,
    facilities: l.facilities ?? [],
    sequence,
    rows: rows.map(({ x: _x, y: _y, ...r }) => r),
    aisles: aisles.map((a) => ({ id: a.id, kind: a.kind, widthMm: num(a.widthMm ?? 1200) })),
    trays: ((l.trays as Json[]) ?? []).map((t) => {
      const c = num(t.x) + num(t.widthMm) / 2;
      const near = [...aisles].sort((a, b) => Math.abs(aisleCenter(a) - c) - Math.abs(aisleCenter(b) - c))[0];
      return { id: t.id, kind: t.kind, aisleId: near?.id ?? '', widthMm: Math.min(num(t.widthMm ?? 600), num(near?.widthMm ?? 600)) };
    }).filter((t) => t.aisleId),
  };
}

export function migrateLayout(l: Json): Json {
  const out = sequenceLayout(rotateLayout(l));
  return { ...out, feeds: (out.feeds as Json[] | undefined) ?? [], doors: (out.doors as Json[] | undefined) ?? [] };
}

/** Removed form factor "QSFP-DD800" -> "QSFP-DD" (an 800G QSFP-DD cage); old built-in device id renamed. */
const RENAMED_FORM_FACTORS: Record<string, string> = { 'QSFP-DD800': 'QSFP-DD' };
const RENAMED_IDS: Record<string, string> = {
  'switch-32x800g-qsfpdd800': 'switch-32x800g-qsfpdd',
  // Network racks are 600 mm wide.
  'network-48ru-800': 'network-48ru-600',
};
const renameFf = (x: Json): Json => {
  const ff = RENAMED_FORM_FACTORS[String(x.formFactor)];
  if (!ff) return x;
  return { ...x, formFactor: ff, ...(x.label === x.formFactor ? { label: ff } : {}) };
};
const renameId = (id: unknown) => RENAMED_IDS[String(id)] ?? id;

function migrateRenames(p: Json): Json {
  const props = (p.builtinProperties as Json | undefined) ?? {};
  return {
    ...p,
    devices: ((p.devices as Json[]) ?? []).map((d) => ({ ...d, ports: ((d.ports as Json[]) ?? []).map(renameFf) })),
    optics: ((p.optics as Json[]) ?? []).map(renameFf),
    rackDesigns: ((p.rackDesigns as Json[]) ?? []).map((d) => ({
      ...d, templateId: renameId(d.templateId),
      placements: ((d.placements as Json[]) ?? []).map((x) => ({ ...x, deviceId: renameId(x.deviceId) })),
    })),
    hiddenBuiltins: ((p.hiddenBuiltins as unknown[]) ?? []).map(renameId),
    builtinProperties: Object.fromEntries(Object.entries(props).map(([k, v]) => [renameId(k), v])),
  };
}

/** Old cable `{ connector, breakout? }` -> `{ ends: { a, b }, mapping }`. */
export function migrateCable(c: Json): Json {
  if (c.ends) return c;
  const { connector, breakout, ...rest } = c;
  const bo = breakout as Json | undefined;
  const conn = String(connector ?? '');
  const fibers = c.fiberCount === undefined ? undefined : Number(c.fiberCount);
  const a = { count: 1, connector: conn, ...(fibers ? { fibers } : {}) };
  const b = bo
    ? { count: Number(bo.count ?? 1), connector: String(bo.connector ?? conn), ...(fibers ? { fibers: Math.floor(fibers / Number(bo.count ?? 1)) } : {}) }
    : { ...a };
  return { ...rest, ends: { a, b }, mapping: 'straight' };
}

/**
 * Vendor, model and custom property values moved from item types to items: each project device /
 * optic / cable that carried them gets its generic item `<id>--generic` with those values.
 */
function migrateVariants(p: Json): Json {
  const variants = [...((p.variants as Json[]) ?? [])];
  const have = new Set(variants.map((v) => v.id));
  const strip = (list: Json[] | undefined, target: string) => (list ?? []).map((item) => {
    const { vendor, model, properties, ...rest } = item;
    const gid = `${String(item.id)}--generic`;
    if ((vendor || model || properties) && !have.has(gid)) {
      variants.push({ id: gid, name: String(model || item.name || item.id), target, itemId: item.id,
        vendor: String(vendor ?? ''), model: String(model ?? ''), ...(properties ? { properties } : {}) });
      have.add(gid);
    }
    return rest;
  });
  return {
    ...p,
    devices: strip(p.devices as Json[], 'device'),
    optics: strip(p.optics as Json[], 'optic'),
    cableMedia: strip(p.cableMedia as Json[], 'cable'),
    variants,
  };
}

export function migrateProjectJson(raw: Json): Json {
  const p = migrateVariants(migrateRenames(raw));
  return {
    ...p,
    cableMedia: ((p.cableMedia as Json[]) ?? []).map(migrateCable),
    layouts: ((p.layouts as Json[]) ?? []).map(migrateLayout),
    optics: ((p.optics as Json[]) ?? []).map(migrateOptic),
    devices: ((p.devices as Json[]) ?? []).map(migrateDevice),
    racks: ((p.racks as Json[]) ?? []).map(migrateRack),
    rackDesigns: ((p.rackDesigns as Json[]) ?? []).map((d) => ({
      ...d,
      // Designs from before abbreviations get one derived from their name.
      abbr: cleanAbbr(String(d.abbr ?? '')) || abbrFromName(String(d.name ?? '')),
      placements: ((d.placements as Json[]) ?? []).map(migratePlacement).map(migrateSideMount),
      cables: ((d.cables as Json[]) ?? []).map((c) => ({
        route: 'left', ...c,
        from: Array.isArray(c.from) ? c.from : c.from ? [c.from] : [],
        to: Array.isArray(c.to) ? c.to : c.to ? [c.to] : [],
      })),
    })),
    hiddenBuiltins: p.hiddenBuiltins ?? [],
  };
}
