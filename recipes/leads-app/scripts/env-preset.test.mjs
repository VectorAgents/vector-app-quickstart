import assert from 'node:assert/strict';
import { test } from 'node:test';
import { presetEnv } from './env-preset.mjs';

const spaceEnv = {
  SPACE_JWKS_URL: 'https://space-api.example.com/api/.well-known/apps/jwks.json',
  ALLOWED_PARENT_ORIGIN: 'https://space.example.com',
  PUBLIC_BASE_URL: 'https://hello-app.example.com',
  SERVER_PORT: '4001',
  CLIENT_PORT: '4173',
};

test('harness mode turns the dev issuer on and sets every value itself', () => {
  const env = presetEnv('harness', {});
  assert.equal(env.VA_DEV_ISSUER, 'true');
  assert.equal(env.SERVER_PORT, '3101');
  assert.equal(env.CLIENT_PORT, '5173');
  assert.equal(env.PUBLIC_BASE_URL, `http://localhost:${env.SERVER_PORT}`);
});

test('harness mode pins the parent origin to the harness origin', () => {
  const env = presetEnv('harness', {});
  assert.equal(env.ALLOWED_PARENT_ORIGIN, `http://localhost:${env.CLIENT_PORT}`);
});

test('harness mode ignores Space values from the shell', () => {
  const env = presetEnv('harness', spaceEnv);
  assert.equal(env.ALLOWED_PARENT_ORIGIN, 'http://localhost:5173');
  assert.equal(env.SERVER_PORT, presetEnv('harness', {}).SERVER_PORT);
  assert.equal(env.SPACE_JWKS_URL, undefined);
});

test('space mode passes the .env values through unchanged', () => {
  const env = presetEnv('space', spaceEnv);
  for (const [key, value] of Object.entries(spaceEnv)) assert.equal(env[key], value);
});

test('space mode never leaves the dev issuer on', () => {
  const env = presetEnv('space', { ...spaceEnv, VA_DEV_ISSUER: 'true' });
  assert.equal('VA_DEV_ISSUER' in env, false);
});

test('an unknown mode is refused', () => {
  assert.throws(() => presetEnv('prod', {}), /harness|space/);
});
