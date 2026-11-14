import { describe, expect, it } from 'vitest';
import { normalizeProject } from '../project/serializer';

describe('built-in items cannot be deleted', () => {
  it('built-ins hidden by older versions come back on load', () => {
    const p = normalizeProject({ schema: 'dc-lab/project@1', hiddenBuiltins: ['network-42ru-600', 'switch-64x800g-osfp'] });
    expect(p.hiddenBuiltins).toEqual([]);
  });
});
