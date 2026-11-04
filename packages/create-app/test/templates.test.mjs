import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { run } from '../src/cli.mjs';
import { loadFlavours } from '../src/starter.mjs';
import { makeIo, tmp } from './fixture.mjs';

const starter = fileURLToPath(new URL('../../../', import.meta.url));

test('the starter root holds no runnable app', () => {
  for (const file of ['package.json', 'client', 'server', 'shared', 'tsconfig.base.json']) {
    assert.equal(existsSync(join(starter, file)), false, `${file} at the starter root`);
  }
});

test('each client and server flavour has a manifest, and each row has exactly one default', () => {
  const flavours = loadFlavours(starter);
  assert.deepEqual(flavours.map((f) => `${f.row}:${f.name}`).sort(), ['client:react', 'server:node']);
  for (const row of ['client', 'server']) {
    assert.equal(flavours.filter((f) => f.row === row && f.default === true).length, 1, row);
  }
  for (const flavour of flavours) assert.equal(flavour.needsShared, true);
});

test('each manifest dev command matches the dev script of its package', () => {
  for (const flavour of loadFlavours(starter)) {
    const pkg = JSON.parse(readFileSync(join(flavour.dir, flavour.row, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts.dev, flavour.dev, flavour.name);
  }
});

test('react + node scaffolds client, server and shared, with the root project files', async () => {
  const dir = join(tmp(), 'hello-app');
  const { io, err } = makeIo();
  const code = await run([dir, '--starter', starter, '--client', 'react', '--server', 'node', '--no-install'], io);
  assert.equal(code, 0, err());
  for (const path of [
    'package.json',
    'tsconfig.base.json',
    '.npmrc',
    '.env.example',
    'scripts/dev.mjs',
    'scripts/env-preset.mjs',
    'scripts/agent-catalog.test.mjs',
    'client/package.json',
    'client/src/App.tsx',
    'server/package.json',
    'server/src/main.ts',
    'shared/package.json',
    'shared/src/index.ts',
  ]) {
    assert.equal(existsSync(join(dir, path)), true, path);
  }
  assert.deepEqual(readdirSync(dir).filter((f) => f.includes('flavour')), []);
});
