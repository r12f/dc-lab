import { describe, expect, it } from 'vitest';
import { useAppStore } from '../../state/store';

describe('restore hidden built-ins', () => {
  it('restores only the given ids (one module), or all', () => {
    const s = useAppStore.getState();
    s.hideBuiltin('network-42ru-600');
    s.hideBuiltin('switch-64x800g-osfp');
    useAppStore.getState().restoreBuiltins(['network-42ru-600']);
    expect(useAppStore.getState().project.hiddenBuiltins).toEqual(['switch-64x800g-osfp']);
    useAppStore.getState().restoreBuiltins();
    expect(useAppStore.getState().project.hiddenBuiltins).toEqual([]);
  });
});
