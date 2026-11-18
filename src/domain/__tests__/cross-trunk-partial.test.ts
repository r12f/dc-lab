import { describe, expect, it } from 'vitest';
import { planCrossCables } from '../layout/cross-cables';
import { Library } from '../library/library';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { emptyProject } from '../project/types';
import type { RackDesign } from '../design/types';
import type { CrossRackEnd, DcLayout } from '../layout/types';

// Rack A: 16 switches, each with a 100G PSM4 (MPO) service port. Rack B: a 288x MMC-16 housing.
const sw: RackDesign = {
  id: 'sw', name: 'sw', templateId: 'network-48ru-600', cables: [],
  placements: Array.from({ length: 16 }, (_, i) => ({
    id: `s${i + 1}`, deviceId: 'switch-64x1600g-osfp', label: `S${i + 1}`, mount: { kind: 'rack', position: 1 + 2 * i, face: 'front' },
    portSettings: { 'service/1': { opticId: 'qsfp28-100g-psm4' } }, groupSettings: {},
  })),
} as unknown as RackDesign;
const fh: RackDesign = {
  id: 'fh', name: 'fh', templateId: 'network-48ru-600', cables: [],
  placements: [{ id: 'h', deviceId: 'fiber-housing-2ru-288xmmc16', label: 'FH1', mount: { kind: 'rack', position: 40, face: 'front' }, portSettings: {}, groupSettings: {} }],
} as unknown as RackDesign;
const layout = {
  id: 'l', name: 'L', room: { widthMm: 1, depthMm: 1 }, whitespace: { x: 0, y: 0, widthMm: 1, depthMm: 1 },
  facilities: [], rows: [], aisles: [], sequence: [], trays: [], doors: [],
  assignments: [{ id: 'A', rowId: 'r', startTile: 0, designId: 'sw', label: 'A' }, { id: 'B', rowId: 'r', startTile: 1, designId: 'fh', label: 'B' }],
} as DcLayout;
const designs = (id: string) => [sw, fh].find((d) => d.id === id);

describe('cross-rack trunk on fewer connectors than its legs', () => {
  it('one 10x MMC-16 / 20x MPO-8 trunk on 10 housing ports and 16 service ports (4 MPO legs spare)', () => {
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
    const mmc: CrossRackEnd[] = Array.from({ length: 10 }, (_, i) => ({ assignmentId: 'B', placementId: 'h', portRef: `rt1/${i + 1}`, connector: 1 }));
    const mpo: CrossRackEnd[] = Array.from({ length: 16 }, (_, i) => ({ assignmentId: 'A', placementId: `s${i + 1}`, portRef: 'service/1', connector: 1 }));
    const plan = planCrossCables(lib, designs, layout, mpo, mmc, 'mmc16-mpo8-160f-trunk-smf');
    expect(plan.error).toBeUndefined();
    expect(plan.cables).toHaveLength(1);
    expect(plan.cables[0].from).toHaveLength(10);
    expect(plan.cables[0].to).toHaveLength(16);
  });
});
