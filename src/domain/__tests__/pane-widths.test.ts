import { describe, expect, it } from 'vitest';
import { DEFAULT_PANES, inspectorWidthFor } from '../../state/preferences';

describe('inspector width per module', () => {
  it('Rack Designer defaults wider than the shared inspector; its own width wins once set', () => {
    expect(inspectorWidthFor('designer', DEFAULT_PANES, {})).toBe(640);
    expect(inspectorWidthFor('designer', DEFAULT_PANES, { designer: 800 })).toBe(800);
    expect(inspectorWidthFor('devices', DEFAULT_PANES, {})).toBe(DEFAULT_PANES.inspector);
    expect(inspectorWidthFor(undefined, { ...DEFAULT_PANES, inspector: 500 }, {})).toBe(500);
  });
});
