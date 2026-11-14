import { traitsOf } from '../device/categories';
import type { Library } from '../library/Library';
import { unitsIn } from '../units';
import type { RackDesign } from './types';
import { opticCounts } from './optics';
import { placementProblem } from './placement';

export interface RackMetrics {
  totalUnits: number;
  usedUnits: number;
  typicalW: number;
  maxW: number;
  supplyCapacityW: number;
  rackMaxPowerW: number;
  deviceWeightKg: number;
  totalWeightKg: number;
  maxLoadKg: number;
  deviceCount: number;
  warnings: string[];
}

export function computeRackMetrics(lib: Library, design: RackDesign): RackMetrics {
  const rack = lib.racks.get(design.templateId);
  const m: RackMetrics = {
    totalUnits: rack?.units ?? 0,
    usedUnits: 0,
    typicalW: 0,
    maxW: 0,
    supplyCapacityW: 0,
    rackMaxPowerW: rack?.maxPowerW ?? 0,
    deviceWeightKg: 0,
    totalWeightKg: (rack?.emptyWeightKg ?? 0) + (rack?.sideElements.reduce((n, e) => n + e.weightKg, 0) ?? 0),
    maxLoadKg: rack?.maxLoadKg ?? 0,
    deviceCount: design.placements.length,
    warnings: [],
  };
  if (!rack) m.warnings.push(`Unknown rack template "${design.templateId}"`);

  for (const p of design.placements) {
    const device = lib.devices.get(p.deviceId);
    if (!device) {
      m.warnings.push(`${p.label}: unknown device "${p.deviceId}"`);
      continue;
    }
    if (rack && p.mount.kind === 'rack') m.usedUnits += Math.max(1, unitsIn(device.height, rack.unitSystem));
    m.typicalW += device.power.typicalW;
    m.maxW += device.power.maxW;
    m.deviceWeightKg += device.weightKg;
    if (traitsOf(device.category).suppliesPower) m.supplyCapacityW += device.power.capacityW ?? 0;
    for (const [opticId, n] of opticCounts(lib, device, p)) {
      const optic = lib.optics.get(opticId);
      if (!optic) continue;
      m.typicalW += optic.powerW * n;
      m.maxW += optic.powerW * n;
      m.deviceWeightKg += (optic.weightKg ?? 0) * n;
    }
    const problem = placementProblem(lib, design, device, p.mount, p.id);
    if (problem) m.warnings.push(`${p.label}: ${problem}`);
  }
  m.totalWeightKg += m.deviceWeightKg;

  if (rack && m.maxW > rack.maxPowerW) m.warnings.push(`Max power ${m.maxW} W exceeds rack rating ${rack.maxPowerW} W`);
  if (m.supplyCapacityW > 0 && m.maxW > m.supplyCapacityW)
    m.warnings.push(`Max power ${m.maxW} W exceeds supply capacity ${m.supplyCapacityW} W`);
  if (rack && m.deviceWeightKg > rack.maxLoadKg)
    m.warnings.push(`Payload ${m.deviceWeightKg.toFixed(0)} kg exceeds rated load ${rack.maxLoadKg} kg`);
  return m;
}
