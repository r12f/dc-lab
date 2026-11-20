import { formatGbps } from '../units';
import { describe, expect, it } from 'vitest';
import { opticFamily, reachOrder } from '../optics/grouping';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { buildTree } from '../../ui/sidebar-tree';
import { cableTreePlacement, opticTreePlacement } from '../optics/grouping';

describe('optic grouping', () => {
  it('QSFP variants share one family', () => {
    expect(['QSFP+', 'QSFP28', 'QSFP56', 'QSFP112'].map(opticFamily)).toEqual(['QSFP', 'QSFP', 'QSFP', 'QSFP']);
    expect(opticFamily('QSFP-DD')).toBe('QSFP-DD');
    expect(opticFamily('QSFP-DD800')).toBe('QSFP-DD');
    expect(opticFamily('SFP28')).toBe('SFP');
  });
  it('reach sorts short to long', () => {
    const r = ['ZR', 'LR4', 'DR8', 'SR4', '2xDR4', 'FR4', 'DR4', 'ER4'];
    expect([...r].sort((a, b) => reachOrder(a) - reachOrder(b))).toEqual(['SR4', 'DR4', '2xDR4', 'DR8', 'FR4', 'LR4', 'ER4', 'ZR']);
  });
  it('tree: QSFP-DD and QSFP folders, speeds high to low, every speed has SR..LR', () => {
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
    const tree = buildTree(lib.optics.items().map((o) => ({ id: o.id, name: o.name, ...opticTreePlacement(o) })));
    const optics = tree.folders[0];
    expect(optics.label).toBe('Optic Module');
    expect(optics.folders.map((f) => f.label)).toEqual(['OSFP', 'QSFP-DD', 'QSFP', 'SFP', 'ELSFP']);
    const [qsfpdd, qsfp] = [optics.folders[1], optics.folders[2]];
    expect(qsfpdd.folders.flatMap((s) => s.items).every((i) => lib.optics.get(i.id)!.formFactor === 'QSFP-DD')).toBe(true);
    expect(qsfp.folders.flatMap((s) => s.items).some((i) => lib.optics.get(i.id)!.formFactor === 'QSFP-DD')).toBe(false);
    for (const speed of [...qsfpdd.folders, ...qsfp.folders]) {
      const reaches = speed.items.map((i) => lib.optics.get(i.id)!.reach);
      expect(reaches.some((r) => /SR/.test(r)), speed.label).toBe(true);
      expect(reaches.some((r) => /LR/.test(r)), speed.label).toBe(true);
    }
  });
});

describe('optics & cables tree', () => {
  it('top level: Optic Module, DAC, AEC, AOC, Power, SMF, MMF, Other; DAC/AEC/AOC by speed', () => {
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
    const tree = buildTree([
      ...lib.optics.items().map((o) => ({ id: o.id, name: o.name, ...opticTreePlacement(o) })),
      ...lib.cableMedia.items().map((c) => ({ id: c.id, name: c.name, ...cableTreePlacement(c) })),
    ]);
    expect(tree.folders.map((f) => f.label)).toEqual([
      'Optic Module', 'DAC', 'AEC', 'AOC', 'Power', 'Single-mode fiber (SMF)', 'Multimode fiber (MMF)', 'Other',
    ]);
    const folder = (...path: string[]) => path.reduce((n, p) => n.folders.find((f) => f.label === p)!, tree);
    expect(folder('AEC').folders.map((f) => f.label)).toEqual(['OSFP', 'QSFP-DD']);
    expect(folder('AEC', 'OSFP').folders.map((f) => f.label)).toEqual(['800G', '1.6T']);
    expect(folder('DAC').folders.map((f) => f.label)).toContain('QSFP-DD<->QSFP56');
    expect(folder('Single-mode fiber (SMF)', 'MMC-16F<->MPO-8F', '10x to 20x').items.map((i) => i.id))
      .toEqual(['mmc16-mpo8-160f-trunk-smf']);
    expect(folder('Power').folders.map((f) => f.label)).toEqual(['C13<->C14', 'C19<->C20']);
    for (const top of tree.folders.slice(1)) expect(top.items, top.label).toEqual([]);
  });
});

describe('1.6T optics', () => {
  it('speed labels switch to T from 1000G', () => {
    expect(formatGbps(800)).toBe('800G');
    expect(formatGbps(1600)).toBe('1.6T');
    expect(formatGbps(3200)).toBe('3.2T');
  });
  it('OSFP has a 1.6T folder first, with SR..ZR reaches', () => {
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
    const tree = buildTree(lib.optics.items().map((o) => ({ id: o.id, name: o.name, ...opticTreePlacement(o) })));
    const osfp = tree.folders[0].folders[0];
    expect(osfp.folders.map((f) => f.label)).toEqual(['1.6T', '800G', '400G']);
    const reaches = osfp.folders[0].items.map((i) => lib.optics.get(i.id)!.reach);
    for (const r of [/SR/, /DR/, /FR/, /LR/, /ZR/]) expect(reaches.some((x) => r.test(x)), String(r)).toBe(true);
  });
});
