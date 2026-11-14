import { traitsOf } from '../../domain/device/categories';
import type { Library } from '../../domain/library/library';
import type { CableRun, Mount, Placement, RackDesign } from '../../domain/design/types';
import { defaultMount, nextLabel, newPlacement, placementProblem } from '../../domain/design/placement';
import { uniqueId } from '../../domain/ids';
import { cleanAbbr } from '../../domain/design/abbr';
import { useAppStore } from '../../state/store';

/** Commands on one rack design (command-style API over the store). */
export function useDesignEditor(lib: Library, design: RackDesign | undefined) {
  const update = useAppStore((s) => s.update);
  const mutate = (fn: (d: RackDesign) => RackDesign) => design && update('rackDesigns', design.id, fn);

  /** Places a device; returns an error message or the new placement id. */
  const addDevice = (deviceId: string, mount?: Mount, variantId?: string): { error?: string; id?: string } => {
    const device = lib.devices.get(deviceId);
    if (!design || !device) return { error: 'Unknown device' };
    const target = mount ?? defaultMount(lib, design, device);
    if (!target) return { error: 'No free space in rack' };
    const problem = placementProblem(lib, design, device, target);
    if (problem) return { error: problem };
    const id = uniqueId('p', design.placements.map((p) => p.id));
    const label = nextLabel(design, traitsOf(device.category).labelPrefix);
    const placement = { ...newPlacement(id, deviceId, label, target), ...(variantId ? { variantId } : {}) };
    mutate((d) => ({ ...d, placements: [...d.placements, placement] }));
    return { id };
  };

  const moveTo = (placementId: string, mount: Mount): string | undefined => {
    const p = design?.placements.find((x) => x.id === placementId);
    const device = p && lib.devices.get(p.deviceId);
    if (!design || !p || !device) return 'Unknown placement';
    const problem = placementProblem(lib, design, device, mount, placementId);
    if (!problem) updatePlacement(placementId, (x) => ({ ...x, mount }));
    return problem;
  };

  const updatePlacement = (id: string, fn: (p: Placement) => Placement) =>
    mutate((d) => ({ ...d, placements: d.placements.map((p) => (p.id === id ? fn(p) : p)) }));

  const removePlacement = (id: string) =>
    mutate((d) => ({
      ...d,
      placements: d.placements.filter((p) => p.id !== id),
      cables: d.cables.filter((c) => [...c.from, ...c.to].every((t) => t.placementId !== id)),
    }));

  /** Adds a run and returns its id. */
  const addCable = (cable: Omit<CableRun, 'id'>): string => {
    const id = uniqueId('c', design?.cables.map((c) => c.id) ?? []);
    mutate((d) => ({ ...d, cables: [...d.cables, { ...cable, id }] }));
    return id;
  };
  const updateCable = (id: string, fn: (c: CableRun) => CableRun) =>
    mutate((d) => ({ ...d, cables: d.cables.map((c) => (c.id === id ? fn(c) : c)) }));
  const removeCable = (id: string) => mutate((d) => ({ ...d, cables: d.cables.filter((c) => c.id !== id) }));

  const rename = (name: string) => mutate((d) => ({ ...d, name }));
  const setAbbr = (text: string) => mutate((d) => ({ ...d, abbr: cleanAbbr(text) }));

  return { addDevice, moveTo, updatePlacement, removePlacement, addCable, updateCable, removeCable, rename, setAbbr };
}

export type DesignEditor = ReturnType<typeof useDesignEditor>;
