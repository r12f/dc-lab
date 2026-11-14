import { useCallback } from 'react';
import type { RackDesign } from '../domain/design/types';
import { useAppStore } from './store';

/** Lookup function for rack designs in the current project. */
export function useDesignLookup(): (id: string) => RackDesign | undefined {
  const designs = useAppStore((s) => s.project.rackDesigns);
  return useCallback((id: string) => designs.find((d) => d.id === id), [designs]);
}
