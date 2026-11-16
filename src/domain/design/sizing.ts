import type { DeviceDefinition } from '../device/types';
import { isRepeatable, traitsOf } from '../device/categories';
import type { Library } from '../library/library';
import type { RackTemplate } from '../rack/types';
import { withItemSpecs } from '../items/variants';
import { bomItem } from './bom-items';
import type { Placement, RackDesign } from './types';

/** Copies stacked in a placement: its `repeat` for a repeatable device, else 1. */
export function repeatCount(device: { category: DeviceDefinition['category']; repeatable?: boolean }, repeat?: number): number {
  return isRepeatable(device) ? Math.max(1, Math.round(repeat ?? 1)) : 1;
}

/**
 * A repeatable device placed n times over (one placement, n copies stacked): n x the height, power and weight,
 * same name (the BOM counts n of the item). Fillers also take the rack's unit system (one 1-unit blanking panel
 * item serves RU and OU racks). Other devices are returned unchanged.
 */
export function sizedDevice(device: DeviceDefinition, rack: RackTemplate | undefined, repeat?: number): DeviceDefinition {
  if (!isRepeatable(device)) return device;
  const n = repeatCount(device, repeat);
  const system = traitsOf(device.category).filler ? rack?.unitSystem ?? device.height.system : device.height.system;
  const base = Math.max(1, device.height.units);
  if (n === 1 && system === device.height.system) return device;
  return {
    ...device,
    height: { units: base * n, system },
    weightKg: device.weightKg * n,
    power: { ...device.power, typicalW: device.power.typicalW * n, maxW: device.power.maxW * n,
      ...(device.power.capacityW !== undefined ? { capacityW: device.power.capacityW * n } : {}) },
  };
}

/** The device of a placement as placed: its BOM item's power / weight, a repeatable device with its copies (x n). */
export function placedDevice(lib: Library, design: RackDesign, p: Placement): DeviceDefinition | undefined {
  const d = lib.devices.get(p.deviceId);
  return d && sizedDevice(withItemSpecs(d, bomItem(lib, design, d.id)), lib.racks.get(design.templateId), p.repeat);
}
