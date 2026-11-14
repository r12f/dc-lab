import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/app.css';
import { applyTheme } from './theme/cssVars';
import { themeById } from './theme/registry';
import { useAppStore } from './state/store';

applyTheme(themeById(useAppStore.getState().themeId));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
