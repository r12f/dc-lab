import type { DeviceCategory } from './types';

/** Behaviour and presentation traits per device category (registry pattern). */
export interface CategoryTraits {
  label: string;
  suppliesPower: boolean;
  allowsZeroU: boolean;
}

export const CATEGORY_TRAITS: Record<DeviceCategory, CategoryTraits> = {
  switch: { label: 'Switch', suppliesPower: false, allowsZeroU: false },
  server: { label: 'Server', suppliesPower: false, allowsZeroU: false },
  pdu: { label: 'PDU', suppliesPower: true, allowsZeroU: true },
  'patch-panel': { label: 'Patch Panel', suppliesPower: false, allowsZeroU: true },
  ocs: { label: 'OCS', suppliesPower: false, allowsZeroU: false },
  'power-shelf': { label: 'Power Shelf', suppliesPower: true, allowsZeroU: false },
  storage: { label: 'Storage', suppliesPower: false, allowsZeroU: false },
  other: { label: 'Other', suppliesPower: false, allowsZeroU: true },
};

export const DEVICE_CATEGORIES = Object.keys(CATEGORY_TRAITS) as DeviceCategory[];

export function traitsOf(category: DeviceCategory): CategoryTraits {
  return CATEGORY_TRAITS[category] ?? CATEGORY_TRAITS.other;
}
