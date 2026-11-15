import { expect, it } from 'vitest';
import { portConnectors } from '../ports/optic-match';
import { portLegs } from '../ports/legs';
import type { PortGroup } from '../device/types';

it('a fiber port with 2 stacked MMC-16 connectors has two connector legs', () => {
  const g: PortGroup = { id: 'fm1', label: 'M1', role: 'data', formFactor: 'MMC-16', count: 10, speedGbps: 0, lanes: 32,
    face: 'front', rows: 3, breakoutModes: [], cableGender: 'male', connectorsPerPort: 2, connectorLayout: 'stacked' };
  expect(portConnectors(g)).toEqual({ count: 2, connector: 'MMC-16', cableGender: 'male' });
  expect(portLegs(g, { mode: '' } as never).map((l) => [l.index, l.label])).toEqual([[1, 'MMC-16M'], [2, 'MMC-16M']]);
});
