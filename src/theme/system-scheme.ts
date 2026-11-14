import { useSyncExternalStore } from 'react';

export type Scheme = 'light' | 'dark';

const QUERY = '(prefers-color-scheme: dark)';

export function systemScheme(): Scheme {
  return typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches ? 'dark' : 'light';
}

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia?.(QUERY);
  mql?.addEventListener('change', onChange);
  return () => mql?.removeEventListener('change', onChange);
}

/** Live OS/browser color scheme. */
export function useSystemScheme(): Scheme {
  return useSyncExternalStore(subscribe, systemScheme, () => 'light');
}
