import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import './styles/app.css';
import { applyTheme } from './theme/css-vars';
import { resolveTheme } from './theme/registry';
import { systemScheme } from './theme/system-scheme';
import { usePreferences } from './state/preferences';

// Apply before first render to avoid a flash of the wrong theme.
applyTheme(resolveTheme(usePreferences.getState().themeId, systemScheme()));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
