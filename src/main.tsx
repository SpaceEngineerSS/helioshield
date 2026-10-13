import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/300.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/newsreader/400-italic.css';
import './styles/tokens.css';
import './styles/base.css';
import './ui/ui.css';
import { useStore } from './state/store';
import App from './App';

// Apply the theme synchronously, before React renders, so canvas code that reads
// CSS variables during render (charts, scene, map) always sees the right palette.
const applyTheme = (theme: string) => {
  document.documentElement.dataset.theme = theme;
};
applyTheme(useStore.getState().theme);
useStore.subscribe((s, prev) => {
  if (s.theme !== prev.theme) applyTheme(s.theme);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
