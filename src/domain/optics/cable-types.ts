import type { CableType } from './types';

export const CABLE_TYPES: Record<CableType, string> = {
  'fiber-sm': 'Single-mode fiber (SMF)',
  'fiber-mm': 'Multimode fiber (MMF)',
  'copper-dac': 'DAC',
  aec: 'AEC',
  aoc: 'AOC',
  power: 'Power',
  other: 'Other',
};

/** Longer description shown in the inspector. */
export const CABLE_TYPE_DESCRIPTIONS: Record<CableType, string> = {
  'fiber-sm': 'Single-mode fiber patch / trunk',
  'fiber-mm': 'Multimode fiber patch / trunk',
  'copper-dac': 'Direct-attach copper, passive',
  aec: 'Active electrical cable: copper with retimers in each plug',
  aoc: 'Active optical cable: fiber with optics built into each plug',
  power: 'Power cord',
  other: 'Other',
};

export const isFiber = (t: CableType): boolean => t === 'fiber-sm' || t === 'fiber-mm';

/** DAC, AEC and AOC: plugs on both ends go straight into module cages (no transceiver). */
export const isDirectAttach = (t: CableType): boolean => t === 'copper-dac' || t === 'aec' || t === 'aoc';

/** Active cables draw power in each plug. */
export const isActiveCable = (t: CableType): boolean => t === 'aec' || t === 'aoc';
