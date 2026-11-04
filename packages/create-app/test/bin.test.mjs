import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { makeStarter, standardTemplates, tmp } from './fixture.mjs';
import { starterUrl } from '../src/starter.mjs';

const bin = fileURLToPath(new URL('../bin/create-app.mjs', import.meta.url));
const cli = (args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', input: '' });

test('without a terminal and without flags the process exits 1 and lists the valid flavours', () => {
  const starter = makeStarter({ templates: standardTemplates() });
  const dir = join(tmp(), 'app');
  const result = cli([dir, '--starter', starter]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Missing --client/);
  assert.match(result.stderr, /react\b.*React/);
  assert.equal(existsSync(dir), false);
});

test('with all flags the process scaffolds and exits 0', () => {
  const starter = makeStarter({ templates: standardTemplates() });
  const dir = join(tmp(), 'app');
  const result = cli([dir, '--starter', starter, '--client', 'react', '--server', 'node', '--no-install']);
  assert.equal(result.status, 0);
  assert.equal(existsSync(join(dir, 'server/src/main.ts')), true);
});

test('the templates come from the main ref of the starter repo unless --ref says otherwise', () => {
  assert.equal(starterUrl('main'), 'https://codeload.github.com/VectorAgents/vector-app-quickstart/tar.gz/main');
  assert.equal(starterUrl('v1'), 'https://codeload.github.com/VectorAgents/vector-app-quickstart/tar.gz/v1');
});
