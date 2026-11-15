import { describe, expect, it } from 'vitest';
import { Library } from '../library/library';
import { emptyProject } from '../project/types';
import { BUILTIN_CATALOG_FOR_TESTS } from './catalog-fixture';
import { newDesign } from '../design/factory';
import { newPlacement } from '../design/placement';
import { rackDeviceOnFace } from '../../features/designer/rack-elevation';

const lib = new Library(BUILTIN_CATALOG_FOR_TESTS, emptyProject());

describe('elevation: devices on the other face', () => {
  it('a device with rear ports (PSU inlets) is drawn on the rear too; a blanking panel is not', () => {
    const d = newDesign('d', 'D', 'network-42ru-600');
    const ms = newPlacement('ms', 'switch-48x1g-mgmt', 'MS1', { kind: 'rack', position: 1, face: 'front' });
    const bp = newPlacement('bp', 'blanking-panel', 'BP1', { kind: 'rack', position: 2, face: 'front' });
    d.placements.push(ms, bp);
    expect(rackDeviceOnFace(lib, d, ms, 'front')).toBe(true);
    expect(rackDeviceOnFace(lib, d, ms, 'rear')).toBe(true);
    expect(rackDeviceOnFace(lib, d, bp, 'rear')).toBe(false);
  });
});
