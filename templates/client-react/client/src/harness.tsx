import { VectorAppsHarness } from '@vectoragents/vs-apps/harness';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VectorAppsHarness />
  </StrictMode>,
);
