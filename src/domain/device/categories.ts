import type { DeviceCategory } from './types';

/** Behaviour and presentation traits per device category (registry pattern). */
export interface CategoryTraits {
  label: string;
  /** Prefix for placement labels in Rack Designer (SW1, SRV2, BP1…). */
  labelPrefix: string;
  suppliesPower: boolean;
  allowsZeroU: boolean;
  /**
   * Units with no ports or power: blanking panels and stiffeners (hardware), or `reserved` —
   * space deliberately left empty: it holds the units but is not hardware, so it has no BOM line.
   */
  filler?: 'blanking' | 'stiffener' | 'reserved' | 'brush';
}

export const CATEGORY_TRAITS: Record<DeviceCategory, CategoryTraits> = {
  switch: { label: 'Switch', labelPrefix: 'SW', suppliesPower: false, allowsZeroU: false },
  server: { label: 'Server', labelPrefix: 'SRV', suppliesPower: false, allowsZeroU: false },
  pdu: { label: 'PDU', labelPrefix: 'PDU', suppliesPower: true, allowsZeroU: true },
  'patch-panel': { label: 'Patch Panel', labelPrefix: 'PP', suppliesPower: false, allowsZeroU: true },
  ocs: { label: 'OCS', labelPrefix: 'OCS', suppliesPower: false, allowsZeroU: false },
  'power-shelf': { label: 'Power Shelf', labelPrefix: 'PS', suppliesPower: true, allowsZeroU: false },
  storage: { label: 'Storage', labelPrefix: 'STG', suppliesPower: false, allowsZeroU: false },
  other: { label: 'Other', labelPrefix: 'DEV', suppliesPower: false, allowsZeroU: true },
  // Appended after 'other' so existing categories keep their palette colors.
  'blanking-panel': { label: 'Blanking Panel', labelPrefix: 'BP', suppliesPower: false, allowsZeroU: false, filler: 'blanking' },
  stiffener: { label: 'Stiffener', labelPrefix: 'STF', suppliesPower: false, allowsZeroU: false, filler: 'stiffener' },
  'brush-panel': { label: 'Brush Panel', labelPrefix: 'BR', suppliesPower: false, allowsZeroU: false, filler: 'brush' },
  reserved: { label: 'Empty (Reserved)', labelPrefix: 'RSV', suppliesPower: false, allowsZeroU: false, filler: 'reserved' },
};

export const DEVICE_CATEGORIES = Object.keys(CATEGORY_TRAITS) as DeviceCategory[];

export function traitsOf(category: DeviceCategory): CategoryTraits {
  return CATEGORY_TRAITS[category] ?? CATEGORY_TRAITS.other;
}
