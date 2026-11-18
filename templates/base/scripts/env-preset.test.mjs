import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { presetEnv } from './env-preset.mjs';

const spaceEnv = {
  SPACE_JWKS_URL: 'https://space-api.example.com/api/.well-known/apps/jwks.json',
  ALLOWED_PARENT_ORIGIN: 'https://space.example.com',
  PUBLIC_BASE_URL: 'https://hello-app.example.com',
  SERVER_PORT: '4001',
  CLIENT_PORT: '4173',
};

function tempKeyFile() {
  return join(mkdtempSync(join(tmpdir(), 'env-preset-')), 'key.json');
}

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
  const env = presetEnv('space', spaceEnv, tempKeyFile());
  for (const [key, value] of Object.entries(spaceEnv)) assert.equal(env[key], value);
});

test('space mode never leaves the dev issuer on', () => {
  const env = presetEnv('space', { ...spaceEnv, VA_DEV_ISSUER: 'true' }, tempKeyFile());
  assert.equal('VA_DEV_ISSUER' in env, false);
});

test('harness mode ignores SPACE_API_URL from the shell', () => {
  const env = presetEnv('harness', { SPACE_API_URL: 'https://space-api.example.com/api' });
  assert.equal(env.SPACE_API_URL, undefined);
});

test('space mode passes SPACE_API_URL through', () => {
  const env = presetEnv('space', { SPACE_API_URL: 'https://space-api.example.com/api' }, tempKeyFile());
  assert.equal(env.SPACE_API_URL, 'https://space-api.example.com/api');
});

test('an unknown mode is refused', () => {
  assert.throws(() => presetEnv('prod', {}), /harness|space/);
});

for (const unset of [{}, { APP_SIGNING_KEY: '' }]) {
  test(`space mode with APP_SIGNING_KEY ${JSON.stringify(unset)} writes the key file and returns the key`, () => {
    const keyFile = tempKeyFile();
    const env = presetEnv('space', { ...spaceEnv, ...unset }, keyFile);
    const key = JSON.parse(env.APP_SIGNING_KEY);
    assert.equal(key.kty, 'EC');
    assert.equal(key.crv, 'P-256');
    assert.equal(typeof key.kid, 'string');
    assert.equal(readFileSync(keyFile, 'utf8').trim(), env.APP_SIGNING_KEY);
  });
}

test('space mode reuses the saved key, so the kid stays the same', () => {
  const keyFile = tempKeyFile();
  const first = JSON.parse(presetEnv('space', spaceEnv, keyFile).APP_SIGNING_KEY);
  const second = JSON.parse(presetEnv('space', spaceEnv, keyFile).APP_SIGNING_KEY);
  assert.equal(second.kid, first.kid);
});

test('space mode keeps a non-empty APP_SIGNING_KEY and writes no key file', () => {
  const keyFile = tempKeyFile();
  const env = presetEnv('space', { ...spaceEnv, APP_SIGNING_KEY: '{"kid":"from-env"}' }, keyFile);
  assert.equal(env.APP_SIGNING_KEY, '{"kid":"from-env"}');
  assert.equal(existsSync(keyFile), false);
});

for (const [label, saved] of [['empty', ''], ['malformed', '{"kty":']]) {
  test(`space mode replaces a ${label} saved key file with a fresh key`, () => {
    const keyFile = tempKeyFile();
    writeFileSync(keyFile, saved);
    const env = presetEnv('space', spaceEnv, keyFile);
    assert.equal(JSON.parse(env.APP_SIGNING_KEY).kty, 'EC');
    assert.equal(readFileSync(keyFile, 'utf8').trim(), env.APP_SIGNING_KEY);
  });
}

test('harness mode sets no signing key, even when the base has one', () => {
  const keyFile = tempKeyFile();
  assert.equal(presetEnv('harness', { APP_SIGNING_KEY: '{"kid":"inherited"}' }, keyFile).APP_SIGNING_KEY, undefined);
  assert.equal(existsSync(keyFile), false);
});
