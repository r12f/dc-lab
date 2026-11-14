import { traitsOf } from '../device/categories';
import type { Library } from '../library/library';
import type { RackDesign } from '../design/types';
import { portItemCounts } from '../design/optics';
import { RACK_KINDS } from '../rack/types';
import { effectiveLengthM } from '../design/cabling';
import { BomBuilder } from './bom-builder';
import type { BomLine } from './types';
import type { CableMedia } from '../optics/types';
import { cableSummary } from '../optics/fiber-map';

function cableVendorModel(media: CableMedia | undefined, id: string): string {
  if (!media) return id;
  return [media.vendor, media.model ?? cableSummary(media)].filter(Boolean).join(' ');
}

export function buildRackBom(lib: Library, design: RackDesign): BomLine[] {
  const bom = new BomBuilder();
  const rack = lib.racks.get(design.templateId);
  if (rack) {
    bom.add({ key: `rack:${rack.id}`, kind: 'rack', item: rack.name, category: RACK_KINDS[rack.kind],
      vendorModel: '', qty: 1, unitW: 0, notes: [], properties: rack.properties });
  }
  for (const p of design.placements) {
    const d = lib.devices.get(p.deviceId);
    if (!d) continue;
    bom.add({ key: `device:${d.id}`, kind: 'device', item: d.name, category: traitsOf(d.category).label,
      vendorModel: [d.vendor, d.model].filter(Boolean).join(' '), qty: 1, unitW: d.power.typicalW, notes: [p.label],
      properties: d.properties });
    const counts = portItemCounts(lib, d, p);
    for (const [cableId, n] of counts.cables) {
      const media = lib.cableMedia.get(cableId);
      bom.add({ key: `portcable:${cableId}`, kind: 'cable', item: media?.name ?? cableId, category: 'Cable',
        vendorModel: cableVendorModel(media, cableId), qty: n, unitW: 0, notes: ['port-attached'],
        properties: media?.properties });
    }
    for (const [opticId, n] of counts.optics) {
      const o = lib.optics.get(opticId);
      if (!o) continue;
      bom.add({ key: `optic:${o.id}`, kind: 'optic', item: o.name, category: 'Optic',
        vendorModel: [o.vendor, o.model ?? `${o.formFactor} ${o.reach}`].filter(Boolean).join(' '), qty: n, unitW: o.powerW,
        notes: o.packaging === 'pigtail' && o.pigtail ? [`pigtail ${o.pigtail.count}x ${o.pigtail.connector} ${o.pigtail.lengthM} m`] : [],
        properties: o.properties });
    }
  }
  for (const c of design.cables) {
    const media = lib.cableMedia.get(c.mediaId);
    const len = effectiveLengthM(lib, design, c);
    bom.add({ key: `cable:${c.mediaId}:${len}`, kind: 'cable', item: `${media?.name ?? c.mediaId} ${len} m`,
      category: 'Cable', vendorModel: cableVendorModel(media, c.mediaId), qty: c.quantity, unitW: 0,
      lengthM: len * c.quantity, notes: [], properties: media?.properties });
  }
  return bom.build();
}
