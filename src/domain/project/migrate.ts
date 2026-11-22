import { migrateSideKind } from '../rack/side-elements';
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

/** Direct-attach reach classes: cables, never optics. */
const DIRECT_REACH: Record<string, string> = { DAC: 'copper-dac', AEC: 'aec', AOC: 'aoc' };
const directReach = (o: Json) => DIRECT_REACH[String(o.reach ?? o.media ?? '').trim().toUpperCase()] ? String(o.reach ?? o.media).trim().toUpperCase() : undefined;

/** Project optics that were really DAC / AEC / AOC: optic id -> { cable id, reach }; filled per project. */
let directOptics: Record<string, { cable: string; reach: string }> = {};

/** A port setting that pinned a DAC "optic" now sets reach DAC/AEC/AOC and the cable instead. */
function migrateDacSetting(s: Json): Json {
  const id = String(s.opticId);
  const hit = directOptics[id] ?? (DAC_OPTIC_TO_CABLE[id] ? { cable: DAC_OPTIC_TO_CABLE[id], reach: 'DAC' } : undefined);
  if (!hit) return s;
  const { opticId: _o, ...rest } = s;
  void _o;
  return { ...rest, reach: hit.reach, cableId: rest.cableId ?? hit.cable };
}

/**
 * Project optics with a direct-attach reach (DAC / AEC / AOC) move to cables: same id, both ends the module
 * plug, link speed from the optic; power per end only for active cables. Removed from the optics list.
 */
function moveDirectOptics(p: Json): Json {
  directOptics = {};
  const optics = (p.optics as Json[]) ?? [];
  const cables = [...((p.cableMedia as Json[]) ?? [])];
  const have = new Set(cables.map((c) => String(c.id)));
  const kept: Json[] = [];
  for (const o of optics) {
    const reach = directReach(o);
    if (!reach) { kept.push(o); continue; }
    const id = String(o.id);
    const plug = String(o.formFactor ?? o.connector ?? '');
    if (!have.has(id)) {
      const type = DIRECT_REACH[reach];
      cables.push({
        schema: 'dc-lab/cable@1', id, name: String(o.name ?? id), type, color: '#94a3b8',
        ends: { a: { count: 1, connector: plug }, b: { count: 1, connector: plug } }, mapping: 'straight',
        speedGbps: Number(o.speedGbps ?? 0), ...(type === 'copper-dac' ? {} : { powerWPerEnd: Number(o.powerW ?? 0) }),
        ...(o.reachM ? { maxLengthM: Number(o.reachM) } : {}),
      });
      have.add(id);
    }
    directOptics[id] = { cable: id, reach };
  }
  const variants = ((p.variants as Json[]) ?? []).map((v) => (v.target === 'optic' && directOptics[String(v.itemId)] ? { ...v, target: 'cable' } : v));
  return { ...p, optics: kept, cableMedia: cables, variants };
}

/** Renamed reach classes: 100G single-lane DR is "DR1" (LC); 2 km 2xDR4 is "2xDR4+". (PSM4 and DR4 are one type.) */
const REACH_RENAMES: Record<string, string> = { DR: 'DR1', '2xDR4-2': '2xDR4+' };
/** Merged optics: old id -> the one that replaced it (800G OSFP 2xDR4 2 km = 2xDR4+). */
const RENAMED_OPTICS: Record<string, string> = {
  'osfp-800g-2xdr4-2km': 'osfp-800g-2xdr4',
  // 800G 2xDR4 pigtail removed: settings pinned to it use the plain 2xDR4+ module.
  'osfp-800g-2xdr4-pigtail': 'osfp-800g-2xdr4', 'osfp-800g-2xdr4-pigtail-ihs': 'osfp-800g-2xdr4-ihs',
};

function toSetting(v: unknown): unknown {
  const s = migrateDacSetting((typeof v === 'string' ? { mode: v } : v) as Json) as Json;
  const r = typeof s?.reach === 'string' ? REACH_RENAMES[s.reach] : undefined;
  const o = typeof s?.opticId === 'string' ? RENAMED_OPTICS[s.opticId] : undefined;
  return r || o ? { ...s, ...(r ? { reach: r } : {}), ...(o ? { opticId: o } : {}) } : s;
}

/** Profile settings carry no cable (cables are assigned in Rack Designer). */
function toProfileSetting(v: unknown): unknown {
  const { cableId: _c, ...rest } = toSetting(v) as Json;
  void _c;
  return rest;
}

function mapValues(obj: unknown, fn: (v: unknown) => unknown): Json {
  return Object.fromEntries(Object.entries((obj as Json) ?? {}).map(([k, v]) => [k, fn(v)]));
}

function migrateGroup(g: Json): Json {
  const { connector, gender, ...rest } = g;
  // `gender` (briefly the port's own gender) became `cableGender` (the cable end it takes).
  const cableGender = g.cableGender ?? gender;
  return { ...rest, formFactor: g.formFactor ?? connector, role: g.role ?? inferRole(g), ...(cableGender ? { cableGender } : {}) };
}

/** Group fields a pass-through panel's front and rear groups share (anything else may differ). */
const SAME_ON_BOTH_FACES = ['count', 'rows', 'formFactor', 'role', 'lanes', 'speedGbps', 'holes', 'fill', 'bottomUp', 'subPorts', 'firstNumber', 'portNumbers', 'connectorsPerPort', 'connectorLayout', 'faceRow'];

/**
 * Patch panels used to store their rear groups as copies of the front ones (`fm1` / `rm1`). Each front group with a
 * matching rear group (same grid and numbering, in order) becomes ONE pass-through group: the rear is derived from
 * it, keeping the rear group's id, label and cable gender, so cable refs (`rm1/3`) stay valid.
 */
export function mergePassThroughGroups(d: Json): Json {
  if (d.category !== 'patch-panel') return d;
  const ports = (d.ports as Json[]) ?? [];
  if (ports.some((g) => g.passThrough)) return d;
  const front = ports.filter((g) => g.face !== 'rear');
  const rear = ports.filter((g) => g.face === 'rear');
  if (!front.length || front.length !== rear.length) return d;
  const same = (a: Json, b: Json) => SAME_ON_BOTH_FACES.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
  if (!front.every((f, i) => same(f, rear[i]))) return d;
  const merged = front.map((f, i) => {
    const r = rear[i];
    return { ...f, passThrough: { rearId: String(r.id), ...(r.label !== f.label ? { rearLabel: r.label } : {}), ...(r.cableGender !== f.cableGender ? { rearCableGender: r.cableGender } : {}) } };
  });
  return { ...d, ports: merged };
}

export function migrateDevice(d0: Json): Json {
  // Variable height (`resizable`) became Repeatable.
  const { resizable, ...d } = d0;
  if (resizable !== undefined && d.repeatable === undefined) d.repeatable = resizable;
  // Derived pass-through twins are never stored (an older save may have written them).
  const ports = ((mergePassThroughGroups({ ...d, ports: ((d.ports as Json[]) ?? []).filter((g) => !g.passThroughOf) }).ports as Json[]) ?? []).map(migrateGroup);
  const breakoutProfiles = ((d.breakoutProfiles as Json[]) ?? []).map((p) => ({
    ...p,
    groupDefaults: mapValues(p.groupDefaults, toProfileSetting),
    overrides: mapValues(p.overrides, toProfileSetting),
  }));
  const out = { ...d, ports, breakoutProfiles } as Json;
  // Every device has a default breakout profile.
  const def = out.defaultProfileId as string | undefined;
  const ids = breakoutProfiles.map((p) => (p as Json).id);
  if (def && ids.includes(def)) return out;
  // Appended so existing profiles keep their positions.
  return { ...out, defaultProfileId: 'default', breakoutProfiles: ids.includes('default') ? breakoutProfiles : [...breakoutProfiles, { id: 'default', name: 'Default', groupDefaults: {}, overrides: {} }] };
}

export function migratePlacement(p0: Json): Json {
  // Filler height (`units`, of 1-unit items) became a repeat count.
  const { units, ...p } = p0;
  if (units !== undefined && p.repeat === undefined && Number(units) > 1) p.repeat = units;
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
export function migrateRack(r0: Json): Json {
  // Footprint tiles are computed from the dimensions now; a stored value is dropped.
  const { footprintTiles: _f, ...r } = r0;
  void _f;
  // Side element `kind` -> what it accepts, which faces it is open to, inside the enclosure or not.
  if (Array.isArray(r.sideElements)) return { ...r, sideElements: (r.sideElements as Json[]).map(migrateSideKind) };
  const pods = (r.sidePods as { left?: number; right?: number }) ?? {};
  const sideElements = (['left', 'right'] as const)
    .filter((side) => (pods[side] ?? 0) > 0)
    .map((side) => ({
      id: `sidepod-${side}`, name: `Sidepod ${side === 'left' ? 'L' : 'R'}`, faces: 'both', side,
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
/** Project optics with a renamed reach class (100G DR -> DR1, 2xDR4-2 -> 2xDR4+). */
function renameOpticReach(o: Json): Json {
  const r = typeof o.reach === 'string' && (Number(o.speedGbps) === 100 || o.reach === '2xDR4-2') ? REACH_RENAMES[o.reach] : undefined;
  return r ? { ...o, reach: r } : o;
}

export function migrateOptic(o: Json): Json {
  if (o.formFactor) return renameOpticReach(o.packaging ? o : { ...o, packaging: 'module' });
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
      return { id: t.id, kind: t.kind, overId: near?.id ?? '', widthMm: Math.min(num(t.widthMm ?? 600), num(near?.widthMm ?? 600)) };
    }).filter((t) => t.overId),
  };
}

export function migrateLayout(l: Json): Json {
  const out = sequenceLayout(rotateLayout(l));
  // Old per-row kW feeds become the PDU's row list; the kW is now computed.
  const feeds = (out.feeds as Json[] | undefined) ?? [];
  const facilities = ((out.facilities as Json[] | undefined) ?? []).map((f) => {
    const rows = feeds.filter((x) => x.facilityId === f.id).map((x) => x.rowId as string);
    const rowIds = [...new Set([...((f.rowIds as string[] | undefined) ?? []), ...rows])];
    return rowIds.length ? { ...f, rowIds } : f;
  });
  const { feeds: _feeds, ...rest } = out;
  // Trays over an aisle (`aisleId`) became trays over any band (`overId`).
  const trays = ((out.trays as Json[] | undefined) ?? []).map(({ aisleId, ...t }) => ({ ...t, overId: t.overId ?? aisleId }));
  return { ...rest, facilities, trays, doors: (out.doors as Json[] | undefined) ?? [] };
}

/** Removed form factor "QSFP-DD800" -> "QSFP-DD" (an 800G QSFP-DD cage); old built-in device id renamed. */
const RENAMED_FORM_FACTORS: Record<string, string> = { 'QSFP-DD800': 'QSFP-DD' };
const RENAMED_IDS: Record<string, string> = {
  'switch-32x800g-qsfpdd800': 'switch-32x800g-qsfpdd',
  // Network racks are 600 mm wide.
  'network-48ru-800': 'network-48ru-600',
  // 800G OSFP 2xDR4 and its 2 km version are one module (2xDR4+).
  'osfp-800g-2xdr4-2km': 'osfp-800g-2xdr4',
};
const renameFf = (x: Json): Json => {
  const ff = RENAMED_FORM_FACTORS[String(x.formFactor)];
  if (!ff) return x;
  return { ...x, formFactor: ff, ...(x.label === x.formFactor ? { label: ff } : {}) };
};
/** Fixed-size built-in fillers became one size-adjustable item each: old id -> [new id, units]. */
const SIZED_FILLERS: Record<string, [string, number]> = {
  'blanking-panel-1ru': ['blanking-panel', 1], 'blanking-panel-2ru': ['blanking-panel', 2], 'blanking-panel-1ou': ['blanking-panel', 1],
  'brush-panel-1ru': ['brush-panel', 1], 'brush-panel-2ru': ['brush-panel', 2], 'brush-panel-1ou': ['brush-panel', 1],
  'reserved-1ru': ['reserved', 1], 'reserved-2ru': ['reserved', 2], 'reserved-4ru': ['reserved', 4], 'reserved-1ou': ['reserved', 1],
  'stiffener-1ou': ['stiffener', 1],
};
/** Network racks lost their sidepods; designs using a sidepod move to the "(w/ Sidepods)" template. */
const NETWORK_WITH_SIDEPODS: Record<string, string> = {
  'network-42ru-600': 'network-42ru-600-sidepods', 'network-48ru-600': 'network-48ru-600-sidepods',
};
function sidepodTemplate(d: Json): Json {
  const to = NETWORK_WITH_SIDEPODS[String(d.templateId)];
  const usesPod = ((d.placements as Json[]) ?? []).some((p) => {
    const m = p.mount as Json | undefined;
    // Pre-element side mounts ({ side }) were sidepods.
    return m?.kind === 'side' && (!m.elementId || /^sidepod/.test(String(m.elementId)));
  });
  return to && usesPod ? { ...d, templateId: to } : d;
}
const renameId = (id: unknown) => RENAMED_IDS[String(id)] ?? SIZED_FILLERS[String(id)]?.[0] ?? id;
/** Placement of a removed fixed-size filler -> the size-adjustable item with that height. */
const renamePlacement = (x: Json): Json => {
  const sized = SIZED_FILLERS[String(x.deviceId)];
  return sized ? { ...x, deviceId: sized[0], units: x.units ?? sized[1] } : { ...x, deviceId: renameId(x.deviceId) };
};

function migrateRenames(p: Json): Json {
  const props = (p.builtinProperties as Json | undefined) ?? {};
  return {
    ...p,
    devices: ((p.devices as Json[]) ?? []).map((d) => ({ ...d, ports: ((d.ports as Json[]) ?? []).map(renameFf) })),
    optics: ((p.optics as Json[]) ?? []).map(renameFf),
    rackDesigns: ((p.rackDesigns as Json[]) ?? []).map((d) => ({
      ...d, templateId: renameId(d.templateId),
      placements: ((d.placements as Json[]) ?? []).map(renamePlacement),
    })),
    hiddenBuiltins: [...new Set(((p.hiddenBuiltins as unknown[]) ?? []).map(renameId))],
    variants: ((p.variants as Json[]) ?? []).map((v) => ({ ...v, itemId: renameId(v.itemId) })),
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

/**
 * Items moved from the design to the BOM: a placement's `variantId` and an item's `isDefault` became the design's
 * BOM picks (`bomItems`, keyed by item type). A placement pick wins over a default; the most used one per type.
 */
function migrateBomItems(p: Json): Json {
  const variants = (p.variants as Json[]) ?? [];
  const defaults = variants.filter((v) => v.isDefault).map((v) => [String(v.itemId), String(v.id)] as const);
  return {
    ...p,
    variants: variants.map(({ isDefault: _d, ...v }) => { void _d; return v; }),
    rackDesigns: ((p.rackDesigns as Json[]) ?? []).map((d) => {
      const picks: Record<string, string> = { ...Object.fromEntries(defaults), ...(d.bomItems as Record<string, string> | undefined) };
      const votes = new Map<string, Map<string, number>>();
      for (const pl of (d.placements as Json[]) ?? []) {
        if (!pl.variantId) continue;
        const m = votes.get(String(pl.deviceId)) ?? new Map<string, number>();
        m.set(String(pl.variantId), (m.get(String(pl.variantId)) ?? 0) + 1);
        votes.set(String(pl.deviceId), m);
      }
      for (const [type, m] of votes) picks[type] = [...m].sort((a, b) => b[1] - a[1])[0][0];
      return {
        ...d,
        placements: ((d.placements as Json[]) ?? []).map(({ variantId: _v, ...pl }) => { void _v; return pl; }),
        ...(Object.keys(picks).length ? { bomItems: picks } : {}),
      };
    }),
  };
}

/**
 * Topologies: the estimated BOM's device type per group and optic per pool moved into the YAML (`device_type`,
 * `port_map`); only the item picks stay in `bom`.
 */
function migrateTopology(t: Json): Json {
  const bom = t.bom as Json | undefined;
  if (!bom || !('devices' in bom || 'optics' in bom)) return t;
  const rest = Object.fromEntries(Object.entries(t).filter(([k]) => k !== 'bom'));
  return bom.items ? { ...rest, bom: { items: bom.items } } : rest;
}

export function migrateProjectJson(raw: Json): Json {
  const p = migrateBomItems(moveDirectOptics(migrateVariants(migrateRenames(raw))));
  return {
    ...p,
    ...(Array.isArray(p.topologies) ? { topologies: (p.topologies as Json[]).map(migrateTopology) } : {}),
    cableMedia: ((p.cableMedia as Json[]) ?? []).map(migrateCable),
    layouts: ((p.layouts as Json[]) ?? []).map(migrateLayout),
    optics: ((p.optics as Json[]) ?? []).map(migrateOptic),
    devices: ((p.devices as Json[]) ?? []).map(migrateDevice),
    racks: ((p.racks as Json[]) ?? []).map(migrateRack),
    rackDesigns: ((p.rackDesigns as Json[]) ?? []).map(sidepodTemplate).map((d) => ({
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
    // Profile edits on built-in devices: same setting migrations as device profiles.
    builtinProfiles: Object.fromEntries(Object.entries((p.builtinProfiles as Json | undefined) ?? {}).map(([id, bp]) => [id, {
      ...(bp as Json),
      breakoutProfiles: (((bp as Json).breakoutProfiles as Json[]) ?? []).map((x) => ({
        ...x, groupDefaults: mapValues(x.groupDefaults, toProfileSetting), overrides: mapValues(x.overrides, toProfileSetting),
      })),
    }])),
  };
}
