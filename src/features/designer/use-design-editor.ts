import { traitsOf } from '../../domain/device/categories';
import type { Library } from '../../domain/library/library';
import type { CableRun, Mount, Placement, RackDesign, CableEndpoint } from '../../domain/design/types';
import { defaultMount, duplicatePlacement, nextLabel, newPlacement, placementProblem } from '../../domain/design/placement';
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
    if (!target) return { error: device.height.units === 0 ? 'No free side slot for a 0U device' : 'No free space in rack' };
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

  /** Sets the height of a size-adjustable filler; returns the problem when it does not fit. */
  const resize = (placementId: string, units: number): string | undefined => {
    const p = design?.placements.find((x) => x.id === placementId);
    const device = p && lib.devices.get(p.deviceId);
    if (!design || !p || !device) return 'Unknown placement';
    const problem = placementProblem(lib, design, device, p.mount, placementId, units);
    if (!problem) updatePlacement(placementId, (x) => ({ ...x, units }));
    return problem;
  };

  const updatePlacement = (id: string, fn: (p: Placement) => Placement) =>
    mutate((d) => ({ ...d, placements: d.placements.map((p) => (p.id === id ? fn(p) : p)) }));

  /** Copies a placement next to it; returns an error message or the new placement id. */
  const duplicatePlacementCmd = (id: string): { error?: string; id?: string } => {
    if (!design) return { error: 'No design' };
    const copy = duplicatePlacement(lib, design, id, uniqueId('p', design.placements.map((p) => p.id)));
    if (!copy) return { error: 'No free space in rack for a copy' };
    mutate((d) => ({ ...d, placements: [...d.placements, copy] }));
    return { id: copy.id };
  };

  const removePlacement = (id: string) =>
    mutate((d) => ({
      ...d,
      placements: d.placements.filter((p) => p.id !== id),
      crossRack: d.crossRack?.filter((e) => e.placementId !== id),
      cables: d.cables.filter((c) => [...c.from, ...c.to].every((t) => t.placementId !== id)),
    }));

  /** Adds a run and returns its id. */
  const addCable = (cable: Omit<CableRun, 'id'>): string => {
    const id = uniqueId('c', design?.cables.map((c) => c.id) ?? []);
    mutate((d) => ({ ...d, cables: [...d.cables, { ...cable, id }] }));
    return id;
  };
  /** Adds several runs in one change (ids unique among each other); returns their ids. */
  const addCables = (cables: Omit<CableRun, 'id'>[]): string[] => {
    const ids: string[] = [];
    const taken = design?.cables.map((c) => c.id) ?? [];
    for (let i = 0; i < cables.length; i++) ids.push(uniqueId('c', [...taken, ...ids]));
    mutate((d) => ({ ...d, cables: [...d.cables, ...cables.map((c, i) => ({ ...c, id: ids[i] }))] }));
    return ids;
  };
  const updateCable = (id: string, fn: (c: CableRun) => CableRun) =>
    mutate((d) => ({ ...d, cables: d.cables.map((c) => (c.id === id ? fn(c) : c)) }));
  const removeCable = (id: string) => mutate((d) => ({ ...d, cables: d.cables.filter((c) => c.id !== id) }));

  const setCrossRack = (crossRack: CableEndpoint[]) => mutate((d) => ({ ...d, crossRack }));
  const rename = (name: string) => mutate((d) => ({ ...d, name }));
  const setAbbr = (text: string) => mutate((d) => ({ ...d, abbr: cleanAbbr(text) }));

  return { addDevice, moveTo, resize, updatePlacement, duplicatePlacement: duplicatePlacementCmd, removePlacement, addCable, addCables, updateCable, removeCable, setCrossRack, rename, setAbbr };
}

export type DesignEditor = ReturnType<typeof useDesignEditor>;
