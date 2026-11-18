import { createAppPlatform } from '@vectoragents/vs-apps/server';
import type { AppSigningKeys } from '@vectoragents/vs-apps/server';
import { loadDevIssuer } from './dev-issuer';
import { manifests } from './manifests';

const devIssuer = process.env.VA_DEV_ISSUER === 'true';

// An empty value counts as unset: `--env-file=.env` passes `APP_SIGNING_KEY=` as an empty string.
function readSigningKeys(): AppSigningKeys {
  const raw = process.env.APP_SIGNING_KEY?.trim();
  if (raw) return { signing: JSON.parse(raw) };
  throw new Error(
    'APP_SIGNING_KEY is not set. Set it to the private key as a JWK JSON string, with a "kid". ' +
      'Make one with the node -e command in the README, or run npm run dev:space, which makes a key for you.',
  );
}

export const platform = createAppPlatform({
  options: {
    // The platform takes the Space origin; SPACE_API_URL ends in /api.
    spaceBaseUrl: (process.env.SPACE_API_URL ?? '').replace(/\/api\/?$/, ''),
    spaceJwksUrl: process.env.SPACE_JWKS_URL ?? '',
    allowedParentOrigin: process.env.ALLOWED_PARENT_ORIGIN ?? '',
  },
  manifests,
  signingKeys: devIssuer ? undefined : readSigningKeys(),
  // Harness mode has no Space JWKS: the platform verifies tokens it mints itself. dev:space leaves VA_DEV_ISSUER unset.
  devIssuer: devIssuer ? await loadDevIssuer() : undefined,
});
