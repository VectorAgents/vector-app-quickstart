import { createAppPlatform } from '@vectoragents/vs-apps/server';
import { MemoryCredentialStore } from './credential-store';
import { loadDevIssuer } from './dev-issuer';
import { manifests } from './manifests';

export const platform = createAppPlatform({
  options: {
    // The platform takes the Space origin; SPACE_API_URL ends in /api.
    spaceBaseUrl: (process.env.SPACE_API_URL ?? '').replace(/\/api\/?$/, ''),
    spaceJwksUrl: process.env.SPACE_JWKS_URL ?? '',
    allowedParentOrigin: process.env.ALLOWED_PARENT_ORIGIN ?? '',
  },
  manifests,
  credentialStore: new MemoryCredentialStore(),
  // Harness mode has no Space JWKS: the platform verifies tokens it mints itself. dev:space leaves VA_DEV_ISSUER unset.
  devIssuer: process.env.VA_DEV_ISSUER === 'true' ? await loadDevIssuer() : undefined,
});
