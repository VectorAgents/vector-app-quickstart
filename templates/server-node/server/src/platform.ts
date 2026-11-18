import { createAppPlatform } from '@vectoragents/vs-apps/server';
import type { AppSigningKeys } from '@vectoragents/vs-apps/server';
import { loadDevIssuer } from './dev-issuer';
import { manifests } from './manifests';

const devIssuer = process.env.VA_DEV_ISSUER === 'true';

// An empty value counts as unset: `--env-file=.env` passes `APP_SIGNING_KEY=` as an empty string.
function readSigningKeys(): AppSigningKeys {
  const raw = process.env.APP_SIGNING_KEY?.trim();
  if (raw) {
    try {
      return { signing: JSON.parse(raw) };
    } catch {
      throw new Error('APP_SIGNING_KEY is not valid JSON. Set it to the private key as a JWK JSON string.');
    }
  }
  throw new Error(
    'APP_SIGNING_KEY is not set. Set it to the private key as a JWK JSON string, with a "kid". ' +
      'Make one with this command, or run npm run dev:space, which makes a key for you:\n' +
      `node -e "const{generateKeyPairSync:g,randomUUID:u}=require('node:crypto');console.log(JSON.stringify({...g('ec',{namedCurve:'P-256'}).privateKey.export({format:'jwk'}),kid:u()}))"`,
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
