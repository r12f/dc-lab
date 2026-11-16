export type BomKind = 'rack' | 'device' | 'optic' | 'cable';

export interface BomLine {
  key: string;
  kind: BomKind;
  item: string;
  category: string;
  vendorModel: string;
  /** Item type the line buys (device / rack / optic / cable id); its items are the line's choices. */
  itemTypeId?: string;
  /** Key of the design's BOM item pick for this line (`RackDesign.bomItems`). */
  pickKey?: string;
  /** Id of the item (vendor product) the line uses. */
  itemId?: string;
  /** True when the item is fixed on the cable run (cabling view), not picked in the BOM. */
  itemFixed?: boolean;
  /** Key of the line's "SI may adjust" flag (`RackDesign.bomSiAdjustable`). */
  siKey?: string;
  /** System integrator may optimise / adjust this line (e.g. cable length). */
  siAdjustable?: boolean;
  qty: number;
  unitW: number;
  /** Cable length in metres (cables only). */
  lengthM?: number;
  notes: string[];
  /** Custom property values (by property id) of the device or rack this line is for. */
  properties?: Record<string, string | number | boolean>;
}

export function lineTotalW(line: BomLine): number {
  return line.unitW * line.qty;
}
