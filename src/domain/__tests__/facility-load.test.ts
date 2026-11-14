import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS, SHIPPED_CATALOG } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { computeFacilityLoads, facilityCapacityKw, pruneFacilityLinks, rowHotAisle } from '../layout/facility-load';
import { computeDcMetrics } from '../layout/metrics';
import { newFacility, newLayout } from '../layout/factory';
import { normalizeProject } from '../project/serializer';
import type { RackDesign } from '../design/types';
import type { DcLayout, Row } from '../layout/types';
import type { DeviceDefinition } from '../device/types';

const dev = (id: string, category: DeviceDefinition['category'], maxW: number, extra: Partial<DeviceDefinition> = {}): DeviceDefinition => ({
  id, name: id, category, height: { units: 2, system: 'RU' }, depthMm: 800, weightKg: 1,
  power: { typicalW: maxW, maxW }, ports: [], breakoutProfiles: [], ...extra,
});
const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, {
  ...emptyProject(),
  devices: [
    dev('load-100', 'server', 100_000),
    dev('chill-40', 'chiller', 5_000, { cooling: { capacityKw: 40, pumpW: 0 } }),
    dev('pdu-300', 'dc-pdu', 0, { power: { typicalW: 0, maxW: 0, capacityW: 300_000 } }),
  ],
});
const at = { kind: 'rack' as const, position: 1, face: 'front' as const };
const itD = newDesign('it', 'IT', 'mgx-48ru');
itD.placements.push(newPlacement('l', 'load-100', 'L', at));
const pw = newDesign('pw', 'P', 'power-rack-48ru');
pw.placements.push(newPlacement('s', 'power-shelf-mgx-110kw', 'PS', at));
const ch = newDesign('ch', 'C', 'chiller-rack-in-row');
ch.placements.push(newPlacement('c', 'chill-40', 'CH', at));
const all: RackDesign[] = [itD, pw, ch];
const designs = (id: string) => all.find((d) => d.id === id);

const row = (id: string, frontFacing: Row['frontFacing']): Row => ({ id, name: id, tileCount: 10, tileWidthMm: 600, tileDepthMm: 1200, powerBudgetKw: 9999, frontFacing });

/** cold | r1 (front west) | hot | r2 (front east) | cold — both rows exhaust into the hot aisle. */
function layout(): DcLayout {
  return {
    ...newLayout('l', 'L'),
    rows: [row('r1', 'west'), row('r2', 'east')],
    aisles: [{ id: 'c1', kind: 'cold', widthMm: 1200 }, { id: 'h1', kind: 'hot', widthMm: 1200 }, { id: 'c2', kind: 'cold', widthMm: 1200 }],
    sequence: ['c1', 'r1', 'h1', 'r2', 'c2'],
    assignments: [
      { id: 'a1', rowId: 'r1', startTile: 0, designId: 'it', label: 'A1' },
      { id: 'a2', rowId: 'r1', startTile: 1, designId: 'pw', label: 'A2' },
      { id: 'b1', rowId: 'r2', startTile: 0, designId: 'it', label: 'B1' },
      { id: 'b2', rowId: 'r2', startTile: 1, designId: 'ch', label: 'B2' },
    ],
    facilities: [
      { ...newFacility('p1', 'pdu', 0, 0), name: 'PDU-1', deviceId: 'pdu-300', rowIds: ['r1', 'r2'] },
      { ...newFacility('p2', 'pdu', 0, 0), name: 'PDU-2', capacityKw: 50, rowIds: ['r2'] },
      { ...newFacility('k1', 'cooling', 0, 0), name: 'CRAH-1', capacityKw: 100, aisleIds: ['h1'] },
    ],
  };
}

describe('facility loads are computed, not entered', () => {
  const l = layout();
  const loads = computeFacilityLoads(lib, designs, l);
  it('row demand = max power of its racks; power racks excluded, chillers included', () => {
    expect(loads.rowDemandKw.get('r1')).toBe(100);
    expect(loads.rowDemandKw.get('r2')).toBe(105);
  });
  it('a row fed by n PDUs takes 1/n from each; a PDU over its max power warns', () => {
    expect(loads.facility.get('p1')).toMatchObject({ loadKw: 100 + 52.5, capacityKw: 300 });
    expect(loads.facility.get('p2')).toMatchObject({ loadKw: 52.5, capacityKw: 50 });
    expect(loads.warnings).toContain('PDU-2: feeds 52.5 kW but max is 50 kW');
  });
  it('max power: facility setting, else its item', () => {
    expect(facilityCapacityKw(lib, l.facilities[0])).toBe(300);
    expect(facilityCapacityKw(lib, { ...l.facilities[0], capacityKw: 200 })).toBe(200);
  });
  it('hot aisle heat = rows exhausting into it minus in-row chillers; cooling is checked against it', () => {
    expect(rowHotAisle(l, 'r1')).toBe('h1');
    expect(rowHotAisle(l, 'r2')).toBe('h1');
    expect(loads.aisleChillerKw.get('h1')).toBe(40);
    expect(loads.aisleHeatKw.get('h1')).toBe(100 + 105 - 40);
    expect(loads.warnings).toContain('CRAH-1: cools 165.0 kW but max is 100 kW');
    expect(computeDcMetrics(lib, designs, l).warnings).toContain('CRAH-1: cools 165.0 kW but max is 100 kW');
  });
  it('deleting rows / aisles drops the links', () => {
    const p = pruneFacilityLinks({ ...l, rows: l.rows.filter((r) => r.id !== 'r2'), aisles: [] });
    expect(p.facilities[0].rowIds).toEqual(['r1']);
    expect(p.facilities[2].aisleIds).toEqual([]);
  });
});

describe('migration and catalog', () => {
  it('old kW feeds become the PDU row list', () => {
    const p = normalizeProject({ layouts: [{ id: 'l', name: 'L', rows: [], aisles: [], sequence: [], trays: [], assignments: [],
      facilities: [{ id: 'p', kind: 'pdu', name: 'P', x: 0, y: 0, widthMm: 1, depthMm: 1 }],
      feeds: [{ id: 'f', facilityId: 'p', rowId: 'r1', kw: 100 }],
      room: { widthMm: 1, depthMm: 1 }, whitespace: { x: 0, y: 0, widthMm: 1, depthMm: 1 } }] });
    expect(p.layouts[0].facilities[0].rowIds).toEqual(['r1']);
    expect('feeds' in p.layouts[0]).toBe(false);
  });
  it('ships a DC PDU item, an in-row chiller and a chiller rack', () => {
    expect(SHIPPED_CATALOG.devices.find((d) => d.category === 'dc-pdu')).toBeTruthy();
    expect(SHIPPED_CATALOG.devices.find((d) => d.category === 'chiller')?.cooling).toBeTruthy();
    expect(SHIPPED_CATALOG.racks.find((r) => r.kind === 'chiller')?.units).toBe(48);
  });
});
