const SERVER_PORT = '3101';

const HARNESS = {
  SERVER_PORT,
  CLIENT_PORT: '5173',
  PUBLIC_BASE_URL: `http://localhost:${SERVER_PORT}`,
  // The harness page is the iframe's parent, so its origin is the client origin.
  ALLOWED_PARENT_ORIGIN: 'http://localhost:5173',
  VA_DEV_ISSUER: 'true',
};

/**
 * Builds the environment for the server and the client.
 * `harness` sets every value itself. `space` keeps the values from `.env` and never enables the dev issuer.
 */
export function presetEnv(mode, base) {
  const env = { ...base };
  if (mode === 'harness') {
    delete env.SPACE_JWKS_URL;
    return Object.assign(env, HARNESS);
  }
  if (mode === 'space') {
    delete env.VA_DEV_ISSUER;
    return env;
  }
  throw new Error(`Unknown mode "${mode}". Use "harness" or "space".`);
}
