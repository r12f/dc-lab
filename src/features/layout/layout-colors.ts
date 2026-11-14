import type { FacilityKind } from '../../domain/layout/types';

/** Semantic colors that stay fixed across themes. */
export const AISLE_COLORS = { cold: '#3B82F6', hot: '#EF4444' } as const;
export const TRAY_COLORS = { data: '#F59E0B', power: '#64748B' } as const;
export const FACILITY_COLORS: Record<FacilityKind, string> = { pdu: '#D97706', cooling: '#06B6D4', other: '#64748B' };
