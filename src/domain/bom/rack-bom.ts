import { traitsOf } from '../device/categories';
import type { Library } from '../library/library';
import type { RackDesign } from '../design/types';
import { portItemCounts } from '../design/optics';
import { RACK_KINDS } from '../rack/types';
import { effectiveLengthM } from '../design/cabling';
import { variantLabel } from '../items/variants';
import { BomBuilder } from './bom-builder';
import type { BomLine } from './types';
import { memoByDesign } from '../design/memo';
import { placedDevice, sizeKey } from '../design/sizing';

/**
 * Rack BOM. Device lines are keyed by item (vendor product); optic and cable lines use their item
 * type's default item. Vendor / model and custom property values come from the item.
 */
/** Cached per (library, design) snapshot. */
export const buildRackBom = memoByDesign(computeBuildRackBom);

function computeBuildRackBom(lib: Library, design: RackDesign): BomLine[] {
  const bom = new BomBuilder();
  const item = (itemId: string, variantId?: string) => lib.variants.resolve(itemId, variantId);
  const rack = lib.racks.get(design.templateId);
  if (rack) {
    bom.add({ key: `rack:${rack.id}`, kind: 'rack', item: rack.name, category: RACK_KINDS[rack.kind],
      vendorModel: '', qty: 1, unitW: 0, notes: [], properties: rack.properties });
  }
  for (const p of design.placements) {
    const d = placedDevice(lib, design, p);
    if (!d) continue;
    // Reserved space holds units but is not hardware: nothing to buy.
    if (traitsOf(d.category).filler === 'reserved') continue;
    const v = item(d.id, p.variantId);
    bom.add({ key: `device:${v?.id ?? d.id}${sizeKey(d)}`, kind: 'device', item: d.name, category: traitsOf(d.category).label,
      vendorModel: variantLabel(v), qty: 1, unitW: d.power.typicalW, notes: [p.label], properties: v?.properties });
    const counts = portItemCounts(lib, d, p);
    for (const [cableId, n] of counts.cables) {
      const media = lib.cableMedia.get(cableId);
      const cv = item(cableId);
      bom.add({ key: `portcable:${cableId}`, kind: 'cable', item: media?.name ?? cableId, category: 'Cable',
        vendorModel: variantLabel(cv), qty: n, unitW: media?.powerWPerEnd ?? 0, notes: ['port-attached'], properties: cv?.properties });
    }
    for (const [opticId, n] of counts.optics) {
      const o = lib.optics.get(opticId);
      if (!o) continue;
      const ov = item(o.id);
      bom.add({ key: `optic:${o.id}`, kind: 'optic', item: o.name, category: 'Optic',
        vendorModel: variantLabel(ov), qty: n, unitW: o.powerW,
        notes: o.packaging === 'pigtail' && o.pigtail ? [`pigtail ${o.pigtail.count}x ${o.pigtail.connector} ${o.pigtail.lengthM} m`] : [],
        properties: ov?.properties });
    }
  }
  for (const c of design.cables) {
    const media = lib.cableMedia.get(c.mediaId);
    const cv = item(c.mediaId);
    const len = effectiveLengthM(lib, design, c);
    bom.add({ key: `cable:${c.mediaId}:${len}`, kind: 'cable', item: `${media?.name ?? c.mediaId} ${len} m`,
      category: 'Cable', vendorModel: variantLabel(cv), qty: c.quantity, unitW: 0,
      lengthM: len * c.quantity, notes: [], properties: cv?.properties });
  }
  return bom.build();
}
