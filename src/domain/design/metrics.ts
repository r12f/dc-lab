import { traitsOf } from '../device/categories';
import type { Library } from '../library/library';
import { formatPower, unitsIn } from '../units';
import type { RackDesign } from './types';
import { activeCableW, opticCounts } from './optics';
import { placementProblem } from './placement';
import { placedDevice } from './sizing';
import { memoByDesign } from './memo';

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
  /** Sum of CDU cooling capacity (kW). */
  coolingCapacityKw: number;
  warnings: string[];
}

/** Rack metrics; cached per (library, design) snapshot. */
export const computeRackMetrics = memoByDesign(rackMetrics);

function rackMetrics(lib: Library, design: RackDesign): RackMetrics {
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
    coolingCapacityKw: 0,
    warnings: [],
  };
  if (!rack) m.warnings.push(`Unknown rack template "${design.templateId}"`);

  for (const p of design.placements) {
    const device = placedDevice(lib, design, p);
    if (!device) {
      m.warnings.push(`${p.label}: unknown device "${p.deviceId}"`);
      continue;
    }
    if (rack && p.mount.kind === 'rack') m.usedUnits += Math.max(1, unitsIn(device.height, rack.unitSystem));
    const pumpW = device.cooling?.pumpW ?? 0;
    m.typicalW += device.power.typicalW + pumpW;
    m.maxW += device.power.maxW + pumpW;
    m.coolingCapacityKw += device.cooling?.capacityKw ?? 0;
    m.deviceWeightKg += device.weightKg;
    if (traitsOf(device.category).suppliesPower) m.supplyCapacityW += device.power.capacityW ?? 0;
    for (const [opticId, n] of opticCounts(lib, device, p)) {
      const optic = lib.optics.get(opticId);
      if (!optic) continue;
      m.typicalW += optic.powerW * n;
      m.maxW += optic.powerW * n;
      m.deviceWeightKg += (optic.weightKg ?? 0) * n;
    }
    const cableW = activeCableW(lib, device, p);
    m.typicalW += cableW;
    m.maxW += cableW;
    const problem = placementProblem(lib, design, device, p.mount, p.id);
    if (problem) m.warnings.push(`${p.label}: ${problem}`);
  }
  m.totalWeightKg += m.deviceWeightKg;

  // A 0 rating / load limit means "not rated" (e.g. a sidecar frame whose device carries everything).
  if (rack && rack.maxPowerW > 0 && m.maxW > rack.maxPowerW) m.warnings.push(`Max power ${formatPower(m.maxW)} exceeds rack rating ${formatPower(rack.maxPowerW)}`);
  if (m.supplyCapacityW > 0 && m.maxW > m.supplyCapacityW)
    m.warnings.push(`Max power ${formatPower(m.maxW)} exceeds supply capacity ${formatPower(m.supplyCapacityW)}`);
  if (rack && rack.maxLoadKg > 0 && m.deviceWeightKg > rack.maxLoadKg)
    m.warnings.push(`Payload ${m.deviceWeightKg.toFixed(0)} kg exceeds rated load ${rack.maxLoadKg} kg`);
  return m;
}
