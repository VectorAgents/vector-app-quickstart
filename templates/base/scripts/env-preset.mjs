import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const SERVER_PORT = '3101';

const HARNESS = {
  SERVER_PORT,
  CLIENT_PORT: '5173',
  PUBLIC_BASE_URL: `http://localhost:${SERVER_PORT}`,
  // The harness page is the iframe's parent, so its origin is the client origin.
  ALLOWED_PARENT_ORIGIN: 'http://localhost:5173',
  VA_DEV_ISSUER: 'true',
};

const DEV_KEY_FILE = new URL('../.dev-signing-key.json', import.meta.url);

// A saved key keeps the `kid` and the key set URL stable across runs.
function devSigningKey(keyFile) {
  if (existsSync(keyFile)) return readFileSync(keyFile, 'utf8').trim();
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const json = JSON.stringify({ ...privateKey.export({ format: 'jwk' }), kid: randomUUID() });
  writeFileSync(keyFile, `${json}\n`, { mode: 0o600 });
  return json;
}

/**
 * Builds the environment for the server and the client.
 * `harness` sets every value itself and no signing key. `space` keeps the values from `.env` and never enables the dev issuer.
 * `space` also fills `APP_SIGNING_KEY` from `keyFile` when `.env` leaves it unset or empty, making and saving a key on the first run.
 */
export function presetEnv(mode, base, keyFile = DEV_KEY_FILE) {
  const env = { ...base };
  if (mode === 'harness') {
    delete env.SPACE_JWKS_URL;
    delete env.SPACE_API_URL;
    return Object.assign(env, HARNESS);
  }
  if (mode === 'space') {
    delete env.VA_DEV_ISSUER;
    // An empty value counts as unset: `--env-file=.env` passes `APP_SIGNING_KEY=` as an empty string.
    if (!env.APP_SIGNING_KEY?.trim()) env.APP_SIGNING_KEY = devSigningKey(keyFile);
    return env;
  }
  throw new Error(`Unknown mode "${mode}". Use "harness" or "space".`);
}
