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
  assert.deepEqual(flavours.map((f) => `${f.row}:${f.name}`).sort(), ['client:react', 'server:nest', 'server:node']);
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

test('react + nest scaffolds the Nest server that boots in both run modes', async () => {
  const dir = join(tmp(), 'hello-app');
  const { io, err } = makeIo();
  const code = await run([dir, '--starter', starter, '--client', 'react', '--server', 'nest', '--no-install'], io);
  assert.equal(code, 0, err());
  const read = (path) => readFileSync(join(dir, path), 'utf8');
  for (const path of [
    'server/src/main.ts',
    'server/src/app.module.ts',
    'server/src/manifests.ts',
    'server/src/credential-store.ts',
    'server/src/hello.controller.ts',
    'server/agent-catalog.json',
    'shared/src/index.ts',
    'scripts/agent-catalog.test.mjs',
  ]) {
    assert.equal(existsSync(join(dir, path)), true, path);
  }
  assert.equal(existsSync(join(dir, 'server/src/dev-routes.ts')), false);

  const tsconfig = JSON.parse(read('server/tsconfig.json'));
  assert.equal(tsconfig.compilerOptions.experimentalDecorators, true);
  assert.equal(tsconfig.compilerOptions.emitDecoratorMetadata, true);
  for (const swcrc of ['.swcrc', 'server/.swcrc']) assert.equal(existsSync(join(dir, swcrc)), false, swcrc);

  const pkg = JSON.parse(read('server/package.json'));
  assert.equal(pkg.scripts.dev.startsWith('nodemon '), true);
  for (const name of ['@nestjs/common', '@nestjs/core', '@nestjs/platform-express', 'reflect-metadata', 'rxjs']) {
    assert.equal(typeof pkg.dependencies[name], 'string', name);
  }
  for (const name of ['@swc-node/register', '@swc/core', 'nodemon']) {
    assert.equal(typeof pkg.devDependencies[name], 'string', name);
  }

  assert.match(read('server/src/app.module.ts'), /devIssuer: process\.env\.VA_DEV_ISSUER === 'true'/);
});

for (const server of ['node', 'nest']) {
  test(`--start leads-app on react + ${server} adds the leads page and its capabilities`, async () => {
    const dir = join(tmp(), 'hello-app');
    const { io, err } = makeIo();
    const code = await run([dir, '--starter', starter, '--client', 'react', '--server', server, '--start', 'leads-app', '--no-install'], io);
    assert.equal(code, 0, err());
    const read = (path) => readFileSync(join(dir, path), 'utf8');
    for (const path of ['client/src/LeadsPage.tsx', 'scripts/definition.test.mjs']) {
      assert.equal(existsSync(join(dir, path)), true, path);
    }
    assert.match(read('client/src/App.tsx'), /<LeadsPage \/>/);
    assert.match(read('shared/src/index.ts'), /key: 'lead:manage'/);
    assert.match(read('shared/src/index.ts'), /key: 'icp:manage'/);
    assert.equal(existsSync(join(dir, 'recipes')), false);
  });
}
