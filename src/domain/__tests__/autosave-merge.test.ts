import { describe, expect, it } from 'vitest';
import { mergePersisted } from '../../state/merge-persisted';
import { emptyProject } from '../project/types';

describe('autosave rehydrate', () => {
  it('fills fields missing from an older saved project', () => {
    const old = { schema: 'dc-lab/project@1', name: 'Old', devices: [], racks: [], optics: [], cableMedia: [], rackDesigns: [], layouts: [] };
    const s = mergePersisted({ project: old, tab: 'designer' }, { project: emptyProject(), tab: 'devices' });
    expect(s.tab).toBe('designer');
    expect(s.project.name).toBe('Old');
    expect(s.project.builtinProfiles).toEqual({});
    expect(s.project.builtinProperties).toEqual({});
    expect(s.project.variants).toEqual([]);
  });
});
