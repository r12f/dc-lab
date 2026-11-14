import type { DeviceCategory } from './types';

/** Behaviour and presentation traits per device category (registry pattern). */
export interface CategoryTraits {
  label: string;
  color: string;
  suppliesPower: boolean;
  allowsZeroU: boolean;
}

export const CATEGORY_TRAITS: Record<DeviceCategory, CategoryTraits> = {
  switch: { label: 'Switch', color: '#3b82f6', suppliesPower: false, allowsZeroU: false },
  server: { label: 'Server', color: '#10b981', suppliesPower: false, allowsZeroU: false },
  pdu: { label: 'PDU', color: '#f59e0b', suppliesPower: true, allowsZeroU: true },
  'patch-panel': { label: 'Patch Panel', color: '#8b5cf6', suppliesPower: false, allowsZeroU: true },
  ocs: { label: 'OCS', color: '#ec4899', suppliesPower: false, allowsZeroU: false },
  'power-shelf': { label: 'Power Shelf', color: '#ef4444', suppliesPower: true, allowsZeroU: false },
  storage: { label: 'Storage', color: '#14b8a6', suppliesPower: false, allowsZeroU: false },
  other: { label: 'Other', color: '#64748b', suppliesPower: false, allowsZeroU: true },
};

export const DEVICE_CATEGORIES = Object.keys(CATEGORY_TRAITS) as DeviceCategory[];

export function traitsOf(category: DeviceCategory): CategoryTraits {
  return CATEGORY_TRAITS[category] ?? CATEGORY_TRAITS.other;
}
