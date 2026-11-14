import type { PropertyDef } from '../properties/types';
import { formatValue, valueOf } from '../properties/properties';
import type { BomLine } from './types';
import { lineTotalW } from './types';

/** One BOM column: header + cell text. Shared by the table view and CSV export. */
export interface BomColumn {
  header: string;
  numeric?: boolean;
  cell(line: BomLine): string | number;
}

/** Custom properties marked `showInBom`; each line shows values for its own kind. */
function propertyColumns(defs: readonly PropertyDef[]): BomColumn[] {
  return defs.filter((d) => d.showInBom).map((def) => ({
    header: def.name,
    cell: (l: BomLine) => {
      return def.appliesTo.includes(l.kind) ? formatValue(def, valueOf(l, def)) : '';
    },
  }));
}

export function bomColumns(defs: readonly PropertyDef[], withPowerDetail = false): BomColumn[] {
  return [
    { header: 'Item', cell: (l) => l.item },
    { header: 'Category', cell: (l) => l.category },
    { header: 'Vendor / Model (PN)', cell: (l) => l.vendorModel },
    ...propertyColumns(defs),
    { header: 'Qty', numeric: true, cell: (l) => l.qty },
    ...(withPowerDetail ? [{ header: 'Unit W', numeric: true, cell: (l: BomLine) => l.unitW }] : []),
    { header: 'Total W', numeric: true, cell: (l) => (withPowerDetail ? lineTotalW(l) : l.unitW ? lineTotalW(l) : '') },
    ...(withPowerDetail ? [{ header: 'Notes', cell: (l: BomLine) => l.notes.join(' ') }] : []),
  ];
}
