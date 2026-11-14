import type { FacilityKind } from '../../domain/layout/types';

/** Semantic colors that stay fixed across themes. */
/** Red / orange / yellow are reserved for errors and warnings: hot aisles are violet, power items slate / teal. */
export const AISLE_COLORS = { cold: '#3B82F6', hot: '#A855F7' } as const;
export const TRAY_COLORS = { data: '#0EA5E9', power: '#64748B' } as const;
export const FACILITY_COLORS: Record<FacilityKind, string> = { pdu: '#475569', cooling: '#06B6D4', other: '#64748B' };
