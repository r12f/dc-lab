import type { CableMedia, OpticDefinition, OpticPackaging, Pigtail } from './types';

/** `fiberConnector` implied by a pigtail: "MPO-12" for one leg, "2x MPO-12" for two. */
export function pigtailConnector(p: Pigtail): string {
  return p.count > 1 ? `${p.count}x ${p.connector}` : p.connector;
}

/** Applies a pigtail change and keeps `fiberConnector` in sync. */
export function withPigtail(o: OpticDefinition, pigtail: Pigtail): OpticDefinition {
  return { ...o, pigtail, fiberConnector: pigtailConnector(pigtail) };
}

/** Switches packaging; a pigtail gets a default single-mode MPO-12 leg. */
export function withPackaging(o: OpticDefinition, packaging: OpticPackaging): OpticDefinition {
  if (packaging === 'module') {
    const { pigtail: _drop, ...rest } = o;
    return { ...rest, packaging };
  }
  return withPigtail({ ...o, packaging }, o.pigtail ?? { count: 1, connector: 'MPO-12', fiberType: 'fiber-sm', lengthM: 1 });
}

export function newOptic(id: string, packaging: OpticPackaging): OpticDefinition {
  const base: OpticDefinition = {
    id, name: packaging === 'pigtail' ? 'New pigtail optic' : 'New optic module', packaging,
    formFactor: 'OSFP', speedGbps: 800, reach: 'DR8', fiberConnector: 'MPO-16', reachM: 500, powerW: 15,
  };
  return packaging === 'pigtail' ? withPackaging(base, 'pigtail') : base;
}

export function newCable(id: string): CableMedia {
  return {
    id, name: 'New cable', type: 'fiber-sm', fiberCount: 2, mapping: 'straight', color: '#fde047',
    ends: { a: { count: 1, connector: 'LC', fibers: 2 }, b: { count: 1, connector: 'LC', fibers: 2 } },
  };
}
