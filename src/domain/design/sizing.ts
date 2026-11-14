import type { DeviceDefinition } from '../device/types';
import { isResizable } from '../device/categories';
import type { Library } from '../library/library';
import type { RackTemplate } from '../rack/types';
import { formatHeight } from '../units';
import type { Placement, RackDesign } from './types';

/**
 * Size-adjustable fillers (blanking / brush panels, stiffeners, empty space) are one item each: a placement
 * picks its height (`units`) and the item takes the rack's unit system. Weight scales from the item's
 * default height; the name gets the size ("2RU Blanking Panel"). Other devices are returned unchanged.
 */
export function sizedDevice(device: DeviceDefinition, rack: RackTemplate | undefined, units?: number): DeviceDefinition {
  if (!isResizable(device.category)) return device;
  const base = Math.max(1, device.height.units);
  const n = Math.max(1, Math.round(units ?? base));
  const height = { units: n, system: rack?.unitSystem ?? device.height.system };
  return { ...device, height, weightKg: (device.weightKg / base) * n, name: `${formatHeight(height)} ${device.name}` };
}

/** The device of a placement as placed: size-adjustable fillers at the placement's height. */
export function placedDevice(lib: Library, design: RackDesign, p: Placement): DeviceDefinition | undefined {
  const d = lib.devices.get(p.deviceId);
  return d && sizedDevice(d, lib.racks.get(design.templateId), p.units);
}

/** BOM key suffix: each size of a size-adjustable filler is its own line ("@2RU"). */
export function sizeKey(device: DeviceDefinition): string {
  return isResizable(device.category) ? `@${formatHeight(device.height)}` : '';
}
