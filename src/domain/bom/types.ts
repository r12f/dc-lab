export type BomKind = 'rack' | 'device' | 'optic' | 'cable';

export interface BomLine {
  key: string;
  kind: BomKind;
  item: string;
  category: string;
  vendorModel: string;
  qty: number;
  unitW: number;
  /** Cable length in metres (cables only). */
  lengthM?: number;
  notes: string[];
}

export function lineTotalW(line: BomLine): number {
  return line.unitW * line.qty;
}
