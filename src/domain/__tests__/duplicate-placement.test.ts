import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { duplicatePlacement, newPlacement } from '../design/placement';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());

describe('duplicate a placed device', () => {
  it('copies item, profile and port settings to the next free label, right above the source', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    d.placements.push({ ...newPlacement('a', 'switch-64x800g-osfp', 'SW1', { kind: 'rack', position: 10, face: 'front' }),
      breakoutProfileId: 'x', groupSettings: { osfp: { mode: '2x400G' } } });
    const c = duplicatePlacement(lib, d, 'a', 'b')!;
    const h = lib.devices.get('switch-64x800g-osfp')!.height.units;
    expect(c).toMatchObject({ id: 'b', label: 'SW2', deviceId: 'switch-64x800g-osfp', breakoutProfileId: 'x',
      groupSettings: { osfp: { mode: '2x400G' } }, mount: { kind: 'rack', position: 10 + h, face: 'front' } });
    c.groupSettings.osfp.mode = '1x800G';
    expect(d.placements[0].groupSettings.osfp.mode).toBe('2x400G');
  });
  it('takes the closest free unit when the one above is used; none when the rack is full', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    const top = lib.racks.get('network-42ru-600')!.units;
    d.placements.push(newPlacement('a', 'switch-48x1g-mgmt', 'MS1', { kind: 'rack', position: top, face: 'front' }));
    expect(duplicatePlacement(lib, d, 'a', 'b')?.mount).toMatchObject({ position: top - 1 });
    for (let i = 1; i < top; i++) d.placements.push(newPlacement(`f${i}`, 'switch-48x1g-mgmt', `X${i}`, { kind: 'rack', position: i, face: 'front' }));
    expect(duplicatePlacement(lib, d, 'a', 'b')).toBeUndefined();
  });
});
