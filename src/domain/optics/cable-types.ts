import type { CableType } from './types';

export const CABLE_TYPES: Record<CableType, string> = {
  'fiber-sm': 'Single-mode fiber',
  'fiber-mm': 'Multimode fiber',
  'copper-dac': 'DAC (copper)',
  aoc: 'AOC',
  power: 'Power',
  other: 'Other',
};

export const isFiber = (t: CableType): boolean => t === 'fiber-sm' || t === 'fiber-mm';
