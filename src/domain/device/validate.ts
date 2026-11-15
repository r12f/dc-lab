import type { DeviceDefinition } from './types';
import { isModeFeasible } from './breakout';
import { validateProfile } from './breakout';
import { isFiberConnector } from '../ports/form-factors';

export function validateDevice(device: DeviceDefinition): string[] {
  const errors: string[] = [];
  if (!device.id) errors.push('Missing id');
  if (device.height.units < 0) errors.push('Height must be >= 0');
  if (device.power.maxW < device.power.typicalW) errors.push('Max power is below typical power');
  const groupIds = new Set<string>();
  for (const g of device.ports) {
    if (groupIds.has(g.id)) errors.push(`Duplicate port group id "${g.id}"`);
    groupIds.add(g.id);
    if (isFiberConnector(g.formFactor) && !g.cableGender) errors.push(`${g.label}: set which ${g.formFactor} cable gender it takes (male / female)`);
    for (const m of g.breakoutModes) {
      if (!isModeFeasible(g, m)) errors.push(`${g.label}: ${m} exceeds ${g.speedGbps}G`);
    }
  }
  for (const p of device.breakoutProfiles) {
    errors.push(...validateProfile(device, p).map((e) => `Profile ${p.name}: ${e}`));
  }
  return errors;
}
