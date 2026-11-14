import { describe, expect, it } from 'vitest';
import { opticFamily, reachOrder } from '../optics/grouping';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { buildTree } from '../../ui/sidebar-tree';
import { opticTreePlacement } from '../optics/grouping';

describe('optic grouping', () => {
  it('QSFP variants share one family', () => {
    expect(['QSFP+', 'QSFP28', 'QSFP56', 'QSFP112'].map(opticFamily)).toEqual(['QSFP', 'QSFP', 'QSFP', 'QSFP']);
    expect(opticFamily('QSFP-DD')).toBe('QSFP-DD');
    expect(opticFamily('QSFP-DD800')).toBe('QSFP-DD');
    expect(opticFamily('SFP28')).toBe('SFP');
  });
  it('reach sorts short to long', () => {
    const r = ['ZR', 'LR4', 'DR8', 'SR4', '2xDR4', 'FR4', 'DAC', 'DR4', 'ER4'];
    expect([...r].sort((a, b) => reachOrder(a) - reachOrder(b))).toEqual(['DAC', 'SR4', 'DR4', '2xDR4', 'DR8', 'FR4', 'LR4', 'ER4', 'ZR']);
  });
  it('tree: QSFP-DD and QSFP folders, speeds high to low, every speed has SR..LR', () => {
    const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());
    const tree = buildTree(lib.optics.items().map((o) => ({ id: o.id, name: o.name, ...opticTreePlacement(o) })));
    const optics = tree.folders[0];
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
