import { describe, expect, it } from 'vitest';
import { effectiveMode, isModeAllowed, validateProfile } from '../device/breakout';
import type { DeviceDefinition } from '../device/types';
import sw from '../../catalog/devices/switch-64x800g-osfp.json';

const device = sw as unknown as DeviceDefinition;
const group = device.ports[0];

describe('breakout', () => {
  it('allows declared modes that fit native speed', () => {
    expect(isModeAllowed(group, '8x100G')).toBe(true);
    expect(isModeAllowed(group, '1x800G')).toBe(true);
    expect(isModeAllowed(group, '8x200G')).toBe(false);
  });
  it('resolves per-port overrides over group defaults', () => {
    const profile = device.breakoutProfiles.find((p) => p.id === 'mixed')!;
    expect(effectiveMode(device, 'osfp/1', profile)).toBe('8x100G');
    expect(effectiveMode(device, 'osfp/2', profile)).toBe('4x200G');
    expect(effectiveMode(device, 'osfp/3', profile)).toBe('1x800G');
    expect(effectiveMode(device, 'osfp/3', profile, '2x400G')).toBe('2x400G');
  });
  it('validates built-in profiles', () => {
    for (const p of device.breakoutProfiles) expect(validateProfile(device, p)).toEqual([]);
  });
});
