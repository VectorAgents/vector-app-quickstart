import { readExtractedAgentCatalog } from '@vectoragents/vs-apps/extract';
import { buildManifests } from '@vectoragents/vs-apps/server';
import { definition } from '@hello-app/shared';

// Manifest URLs are public absolute URLs, so an empty base would publish broken ones.
function requirePublicBaseUrl(): string {
  const url = process.env.PUBLIC_BASE_URL;
  if (!url) {
    throw new Error('PUBLIC_BASE_URL is not set. It must be the public absolute URL of this server.');
  }
  return url;
}

export const manifests = buildManifests([definition], {
  catalog: readExtractedAgentCatalog('agent-catalog.json'),
  publicBaseUrl: requirePublicBaseUrl(),
});
