import { traitsOf } from '../device/categories';
import type { Library } from '../library/library';
import type { Placement, RackDesign } from '../design/types';
import { portItemCounts } from '../design/optics';
import { RACK_KINDS } from '../rack/types';
import { SIDE_KINDS } from '../rack/side-elements';
import { effectiveLengthM } from '../design/cabling';
import { cablePowerWPerEnd, opticPowerW, variantLabel } from '../items/variants';
import { BomBuilder } from './bom-builder';
import type { BomLine } from './types';
import { memoByDesign } from '../design/memo';
import { placedDevice, repeatCount } from '../design/sizing';
import { bomItem, cableLengthPickKey } from '../design/bom-items';

/**
 * A node of the rack BOM tree. Group nodes (rack frame, side elements, in-rack cables) structure
 * the tree; nodes with a `line` are purchasable items with a quantity.
 */
export interface BomNode {
  key: string;
  label: string;
  line?: BomLine;
  children: BomNode[];
}

/**
 * Rack BOM as a tree:
 *   Rack (the designed rack as a whole: the design name)
 *   ├─ Rack frame — <template> (the rack itself as an item, qty 1) — devices in rack units, each with its optics and port-attached cables
 *   ├─ <side element> (Sidepod L, PDU bay R…) — devices mounted in it
 *   └─ In-rack cables
 * Devices with the same item in the same container merge into one line (qty, labels in notes).
 * Empty (Reserved) space is not hardware and is left out.
 */
/** Cached per (library, design) snapshot. */
export const buildRackBomTree = memoByDesign(computeBuildRackBomTree);

function computeBuildRackBomTree(lib: Library, design: RackDesign): BomNode | undefined {
  const rack = lib.racks.get(design.templateId);
  if (!rack) return undefined;
  const item = (itemTypeId: string, pickKey?: string) => bomItem(lib, design, itemTypeId, pickKey);
  const pick = (itemTypeId: string, v: { id: string } | undefined, pickKey = itemTypeId) => ({ itemTypeId, pickKey, itemId: v?.id });

  const devicesIn = (placements: Placement[], scope: string): BomNode[] => {
    const groups = new Map<string, { line: BomLine; parts: BomBuilder }>();
    for (const p of placements) {
      const d = placedDevice(lib, design, p);
      if (!d || traitsOf(d.category).filler === 'reserved') continue;
      const v = item(d.id);
      const key = `${scope}:device:${d.id}`;
      const n = repeatCount(d, p.repeat);
      let g = groups.get(key);
      if (!g) {
        g = {
          line: { key, kind: 'device', item: d.name, category: traitsOf(d.category).label, ...pick(d.id, v), vendorModel: variantLabel(v),
            qty: 0, unitW: d.power.typicalW / n, notes: [], properties: v?.properties },
          parts: new BomBuilder(),
        };
        groups.set(key, g);
      }
      g.line.qty += n;
      g.line.notes.push(n > 1 ? `${p.label} x${n}` : p.label);
      const counts = portItemCounts(lib, d, p);
      for (const [opticId, n] of counts.optics) {
        const o = lib.optics.get(opticId);
        if (!o) continue;
        const ov = item(o.id);
        g.parts.add({ key: `${key}:optic:${o.id}`, kind: 'optic', item: o.name, category: 'Optic', ...pick(o.id, ov), vendorModel: variantLabel(ov),
          qty: n, unitW: opticPowerW(ov, o), notes: [], properties: ov?.properties });
      }
      for (const [cableId, n] of counts.cables) {
        const media = lib.cableMedia.get(cableId);
        const cv = item(cableId);
        g.parts.add({ key: `${key}:cable:${cableId}`, kind: 'cable', item: media?.name ?? cableId, category: 'Cable', ...pick(cableId, cv),
          vendorModel: variantLabel(cv), qty: n, unitW: cablePowerWPerEnd(cv, media), notes: ['port-attached'], properties: cv?.properties });
      }
    }
    return [...groups.values()]
      .sort((a, b) => a.line.item.localeCompare(b.line.item))
      .map(({ line, parts }) => ({
        key: line.key, label: line.item, line,
        children: parts.build().map((l) => ({ key: l.key, label: l.item, line: l, children: [] })),
      }));
  };

  const inRack = design.placements.filter((p) => p.mount.kind === 'rack');
  // The rack frame as bought: the item picked in the BOM (else Generic) (vendor / PN, its own property values).
  const rackItem = item(rack.id);
  const children: BomNode[] = [
    {
      key: 'frame', label: `Rack frame — ${rack.name}`,
      line: { key: `rack:${rack.id}`, kind: 'rack', item: rack.name, category: RACK_KINDS[rack.kind],
        ...pick(rack.id, rackItem), vendorModel: variantLabel(rackItem), qty: 1, unitW: 0, notes: [], properties: { ...rack.properties, ...rackItem?.properties } },
      children: devicesIn(inRack, 'frame'),
    },
    ...rack.sideElements.map((e) => ({
      key: `side:${e.id}`,
      label: `${e.name} (${SIDE_KINDS[e.kind].label})`,
      children: devicesIn(design.placements.filter((p) => p.mount.kind === 'side' && p.mount.elementId === e.id), `side:${e.id}`),
    })),
  ];

  const cables = new BomBuilder();
  for (const c of design.cables) {
    const media = lib.cableMedia.get(c.mediaId);
    const len = effectiveLengthM(lib, design, c);
    const cv = item(c.mediaId, cableLengthPickKey(c.mediaId, len));
    cables.add({ key: `cable:${c.mediaId}:${len}`, kind: 'cable', item: `${media?.name ?? c.mediaId} ${len} m`,
      category: 'Cable', ...pick(c.mediaId, cv, cableLengthPickKey(c.mediaId, len)), vendorModel: variantLabel(cv), qty: c.quantity, unitW: 0,
      lengthM: len * c.quantity, notes: [], properties: cv?.properties });
  }
  const cableLines = cables.build();
  if (cableLines.length) {
    children.push({ key: 'cables', label: 'In-rack cables', children: cableLines.map((l) => ({ key: l.key, label: l.item, line: l, children: [] })) });
  }

  // The rack as a whole: a group named after the design; the template is the rack frame line below it.
  return { key: `design:${design.id}`, label: design.name, children };
}

/** Every line in the tree (for totals and checks). */
export function treeLines(node: BomNode | undefined): BomLine[] {
  if (!node) return [];
  return [...(node.line ? [node.line] : []), ...node.children.flatMap(treeLines)];
}
