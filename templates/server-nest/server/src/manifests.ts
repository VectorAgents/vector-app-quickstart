import { readExtractedAgentCatalog } from '@vectoragents/vs-apps/extract';
import { buildManifests } from '@vectoragents/vs-apps/server';
import { definition } from '@hello-app/shared';

export const manifests = buildManifests([definition], {
  catalog: readExtractedAgentCatalog('agent-catalog.json'),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
});
