import type { Theme } from '../types';

export const light: Theme = {
  id: 'light',
  name: 'Light',
  description: 'Light: white panels, slate text, blue accent',
  scheme: 'light',
  general: { accent: '#2563EB', onAccent: '#FFFFFF', text: '#0F172A', muted: '#64748B', subtle: '#CBD5E1', border: '#E2E8F0' },
  surface: { app: '#F1F5F9', panel: '#FFFFFF', panelAlt: '#F8FAFC', selected: '#DBEAFE', hover: '#F1F5F9', input: '#FFFFFF', inputBorder: '#CBD5E1' },
  tab: { focused: { fg: '#FFFFFF', bg: '#2563EB' }, unfocused: { fg: '#CBD5E1', bg: '#0F172A' }, barBg: '#0F172A' },
  header: { fg: '#334155', bg: '#E2E8F0' },
  status: { danger: '#DC2626', warn: '#D97706', ok: '#16A34A' },
  dialog: { border: '#E2E8F0', title: '#0F172A', text: '#0F172A', muted: '#64748B', selected: { fg: '#0F172A', bg: '#EFF6FF' } },
  canvas: {
    paper: '#FFFFFF', ink: '#0F172A', inkMuted: '#475569', grid: '#E2E8F0',
    frame: '#334155', frameText: '#E2E8F0', slot: '#F8FAFC', selection: '#EAB308',
  },
  highlightPalette: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#EF4444', '#14B8A6', '#64748B'],
};
