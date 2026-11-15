import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { fiberMap, cableSummary } from '../optics/fiber-map';
import { connectorsMate } from '../optics/connectors';
import { normalizeProject } from '../project/serializer';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { cableIssues } from '../design/connectors';
import type { CableRun } from '../design/types';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
const cable = (id: string) => lib.cableMedia.get(id)!;

describe('cable model', () => {
  it('Y-cable MMC-16 -> 2x MPO-8: 8 fibers to each leg', () => {
    const m = fiberMap(cable('mmc16-2xmpo8-y-smf'));
    expect(m.pairs).toEqual([[8, 8]]);
    expect([m.unusedA, m.unusedB]).toEqual([0, 0]);
    expect(cableSummary(cable('mmc16-2xmpo8-y-smf'))).toBe('1x MMC-16M → 2x MPO-8F');
  });
  it('4x4 and 2x2 shuffles spread every A over every B', () => {
    expect(fiberMap(cable('mpo8-4x4-shuffle-smf')).pairs).toEqual([[2, 2, 2, 2], [2, 2, 2, 2], [2, 2, 2, 2], [2, 2, 2, 2]]);
    expect(fiberMap(cable('mpo8-2x2-shuffle-smf')).pairs).toEqual([[4, 4], [4, 4]]);
    expect(fiberMap(cable('mmc16-2x-to-mpo8-4x-shuffle-smf')).pairs).toEqual([[4, 4, 4, 4], [4, 4, 4, 4]]);
  });
  it('shuffle lands A connector i at fiber group i of each B connector', () => {
    const links = fiberMap({ ...cable('mpo8-4x4-shuffle-smf'), polarity: 'A' }).links;
    const toB3 = links.filter((l) => l.b.connector === 3).map((l) => [l.a.connector, l.b.fiber]);
    expect(toB3).toEqual([[1, 1], [1, 2], [2, 3], [2, 4], [3, 5], [3, 6], [4, 7], [4, 8]]);
  });
  it('160F trunk: 20 MPO-8 pairs, straight', () => {
    const m = fiberMap(cable('mpo8-160f-trunk-smf'));
    expect(m.links).toHaveLength(160);
    expect(m.pairs.every((row, i) => row.every((n, j) => n === (i === j ? 8 : 0)))).toBe(true);
  });
  it('asymmetric MMC-16 -> MPO-8 drops 8 fibers per A connector', () => {
    expect(fiberMap(cable('mmc16-to-mpo8-smf')).unusedA).toBe(8);
  });
  it('MMC-to-MPO cables are male on the MMC end; the 2x MMC to 2x MPO-8 harness is gone', () => {
    const mmcToMpo = ['mmc16-2xmpo8-y-smf', 'mmc16-2x-to-mpo8-4x-shuffle-smf', 'mmc16-to-mpo8-smf'].map(cable);
    expect(mmcToMpo.every((c) => c.ends.a.connector === 'MMC-16' && c.ends.a.gender === 'male' && /MMC-16M/.test(c.name))).toBe(true);
    expect(lib.cableMedia.get('mmc16-2x-to-mpo8-2x-smf')).toBeUndefined();
  });
  it('4x MPO-8 -> 2x MPO-8 shuffle: 16 fibers, each A connector 2 fibers to each B', () => {
    const m = fiberMap(cable('mpo8-4x2-shuffle-smf'));
    expect(m.links).toHaveLength(16);
    expect(m.pairs).toEqual([[2, 2], [2, 2], [2, 2], [2, 2]]);
  });
  it('polarity B reverses positions on the B side', () => {
    const l = fiberMap(cable('mpo8-smf')).links;
    expect(l[0]).toEqual({ a: { connector: 1, fiber: 1 }, b: { connector: 1, fiber: 8 } });
  });
  it('MPO-8 mates MPO-12; MMC equals MMC-16', () => {
    expect(connectorsMate('MPO-8', 'MPO-12')).toBe(true);
    expect(connectorsMate('MMC', 'MMC-16')).toBe(true);
    expect(connectorsMate('MPO-16', 'MPO-12')).toBe(false);
  });
  it('male trunk end on a transceiver port is flagged pinned-to-pinned', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    const sw = newPlacement('sw', 'switch-64x800g-osfp', 'SW1', { kind: 'rack', position: 1, face: 'front' });
    sw.groupSettings = { osfp: { mode: '2x400G', reach: '2xDR4' } };
    d.placements.push(sw);
    const run: CableRun = { id: 'r', mediaId: 'mpo8-160f-trunk-smf', route: 'left', quantity: 1,
      from: [{ placementId: 'sw', portRef: 'osfp/1', connector: 1 }], to: [{ placementId: 'sw', portRef: 'osfp/2', connector: 1 }] };
    expect(cableIssues(lib, { ...d, cables: [run] }, run)).toContain('A SW1 osfp/1.1: male cable end, port takes female MPO-12');
    const female = { ...run, mediaId: 'mpo8-smf' };
    expect(cableIssues(lib, { ...d, cables: [female] }, female)).toEqual([]);
  });
  it('migrates old connector/breakout cables', () => {
    const p = normalizeProject({ cableMedia: [
      { id: 'x', type: 'fiber-sm', connector: 'MPO-12', fiberCount: 8, breakout: { count: 4, connector: 'LC' }, color: '#fff' },
      { id: 'y', type: 'fiber-sm', connector: 'LC', color: '#fff' },
    ] });
    expect(p.cableMedia[0]).toMatchObject({ mapping: 'straight', ends: { a: { count: 1, connector: 'MPO-12', fibers: 8 }, b: { count: 4, connector: 'LC', fibers: 2 } } });
    expect(p.cableMedia[1].ends).toEqual({ a: { count: 1, connector: 'LC' }, b: { count: 1, connector: 'LC' } });
  });
});
