import { describe, expect, it } from 'vitest';
import { mergePersisted } from '../../state/merge-persisted';
import { emptyProject } from '../project/types';

describe('page reload rehydrate', () => {
  it('restores the module tab but never a project stored by older versions', () => {
    const old = { schema: 'dc-lab/project@1', name: 'Old', devices: [], racks: [], optics: [], cableMedia: [], rackDesigns: [], layouts: [] };
    const empty = emptyProject();
    const s = mergePersisted({ project: old, tab: 'designer' }, { project: empty, tab: 'devices' });
    expect(s.tab).toBe('designer');
    expect(s.project).toBe(empty);
  });
});
