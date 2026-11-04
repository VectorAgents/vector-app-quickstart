import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { run } from '../src/cli.mjs';
import { makeIo, makeStarter, standardTemplates, tmp, withManifest } from './fixture.mjs';

const read = (dir, path) => readFileSync(join(dir, path), 'utf8');

async function scaffold(args, { templates = standardTemplates(), overlays, ...ioOptions } = {}) {
  const starter = makeStarter({ templates, overlays });
  const parent = tmp();
  const dir = join(parent, 'my-app');
  const harness = makeIo(ioOptions);
  const code = await run([dir, '--starter', starter, ...args], harness.io);
  return { code, dir, parent, ...harness };
}

test('scaffolds the chosen client and server over the base files, then installs', async () => {
  const { code, dir, installs } = await scaffold(['--client', 'react', '--server', 'nest']);
  assert.equal(code, 0);
  assert.equal(read(dir, 'package.json'), '{"name":"base"}');
  assert.equal(read(dir, 'client/src/App.tsx'), 'react app');
  assert.equal(read(dir, 'server/src/main.ts'), 'nest server');
  assert.equal(existsSync(join(dir, 'client/src/App.vue')), false);
  assert.equal(existsSync(join(dir, 'flavour.json')), false);
  assert.deepEqual(installs, [dir]);
});

test('--no-install skips the install step', async () => {
  const { code, installs } = await scaffold(['--client', 'react', '--server', 'node', '--no-install']);
  assert.equal(code, 0);
  assert.deepEqual(installs, []);
});

test('shared/ is copied only when a chosen flavour needs it', async () => {
  const needed = await scaffold(['--client', 'react', '--server', 'node', '--no-install']);
  assert.equal(read(needed.dir, 'shared/src/index.ts'), 'shared code');

  const templates = withManifest(standardTemplates(), 'server-node', { needsShared: false });
  const notNeeded = await scaffold(['--client', 'vue', '--server', 'node', '--no-install'], { templates });
  assert.equal(notNeeded.code, 0);
  assert.equal(existsSync(join(notNeeded.dir, 'shared')), false);
});

test('a missing flag without a terminal exits with the valid flavours from the manifests', async () => {
  const { code, err, dir } = await scaffold(['--client', 'react']);
  assert.equal(code, 1);
  assert.match(err(), /Missing --server/);
  assert.match(err(), /node\b.*Node\.js/);
  assert.match(err(), /nest\b.*Nest\.js/);
  assert.equal(existsSync(dir), false);
});

test('an unknown flavour exits with the valid flavours of that row', async () => {
  const { code, err } = await scaffold(['--client', 'svelte', '--server', 'node']);
  assert.equal(code, 1);
  assert.match(err(), /Unknown client "svelte"/);
  assert.match(err(), /react\b.*React/);
  assert.match(err(), /vue\b.*Vue/);
  assert.doesNotMatch(err(), /Nest\.js/);
});

test('an unknown flag exits with an error', async () => {
  const { code, err } = await scaffold(['--client', 'react', '--server', 'node', '--bogus']);
  assert.equal(code, 1);
  assert.match(err(), /--bogus/);
});

test('an unknown schemaVersion is refused with a message to run @latest', async () => {
  const templates = withManifest(standardTemplates(), 'server-nest', { schemaVersion: 2 });
  const { code, err, dir } = await scaffold(['--client', 'react', '--server', 'node'], { templates });
  assert.equal(code, 1);
  assert.match(err(), /npm create @vectoragents\/app@latest/);
  assert.equal(existsSync(dir), false);
});

test('a non-empty target directory is refused', async () => {
  const starter = makeStarter({ templates: standardTemplates() });
  const dir = tmp();
  const args = [dir, '--starter', starter, '--client', 'react', '--server', 'node', '--no-install'];
  assert.equal(await run(args, makeIo().io), 0, 'an empty directory is fine');
  const again = makeIo();
  assert.equal(await run(args, again.io), 1);
  assert.match(again.err(), /not empty/);
});

test('prompts for the directory and each row when a terminal is present, and an empty answer takes the default', async () => {
  const starter = makeStarter({ templates: standardTemplates() });
  const parent = tmp();
  const { io, out } = makeIo({ tty: true, answers: ['my-prompted-app', '', 'nest'] });
  const code = await run(['--starter', starter, '--no-install'], { ...io, cwd: parent });
  assert.equal(code, 0);
  const dir = join(parent, 'my-prompted-app');
  assert.equal(read(dir, 'client/src/App.tsx'), 'react app');
  assert.equal(read(dir, 'server/src/main.ts'), 'nest server');
  assert.match(out(), /React/);
  assert.match(out(), /Nest\.js/);
});

test('flags given on the command line are not prompted for', async () => {
  const starter = makeStarter({ templates: standardTemplates() });
  const parent = tmp();
  const { io, out } = makeIo({ tty: true, answers: ['nest'] });
  const code = await run(['my-app', '--starter', starter, '--client', 'react', '--no-install'], { ...io, cwd: parent });
  assert.equal(code, 0);
  assert.equal(read(join(parent, 'my-app'), 'server/src/main.ts'), 'nest server');
  assert.doesNotMatch(out(), /React/);
});

test('--start defaults to hello and an overlay replaces whole files', async () => {
  const overlays = { 'leads-app': { 'client/src/App.tsx': 'leads app', 'client/src/LeadsPage.tsx': 'leads page' } };
  const plain = await scaffold(['--client', 'react', '--server', 'node', '--no-install'], { overlays });
  assert.equal(read(plain.dir, 'client/src/App.tsx'), 'react app');
  const leads = await scaffold(['--client', 'react', '--server', 'node', '--start', 'leads-app', '--no-install'], { overlays });
  assert.equal(read(leads.dir, 'client/src/App.tsx'), 'leads app');
  assert.equal(read(leads.dir, 'client/src/LeadsPage.tsx'), 'leads page');
});

test('an unknown --start lists the valid starts', async () => {
  const overlays = { 'leads-app': { 'client/src/App.tsx': 'leads app' } };
  const { code, err } = await scaffold(['--client', 'react', '--server', 'node', '--start', 'nope'], { overlays });
  assert.equal(code, 1);
  assert.match(err(), /Unknown start "nope"/);
  assert.match(err(), /hello/);
  assert.match(err(), /leads-app/);
});

test('a failed scaffold leaves nothing behind, so the same command can run again', async () => {
  const broken = { ...standardTemplates(), base: { client: 'a file where client/ should go' } };
  const starter = makeStarter({ templates: broken });
  const parent = tmp();
  const dir = join(parent, 'my-app');
  const args = [dir, '--starter', starter, '--client', 'react', '--server', 'node', '--no-install'];
  const first = makeIo();
  assert.equal(await run(args, first.io), 1);
  assert.deepEqual(readdirSync(parent), []);

  const fixed = makeStarter({ templates: standardTemplates() });
  assert.equal(await run([dir, '--starter', fixed, ...args.slice(3)], makeIo().io), 0);
});

test('a failed scaffold keeps an empty target directory the reader created', async () => {
  const broken = { ...standardTemplates(), base: { client: 'a file where client/ should go' } };
  const starter = makeStarter({ templates: broken });
  const dir = tmp();
  assert.equal(await run([dir, '--starter', starter, '--client', 'react', '--server', 'node', '--no-install'], makeIo().io), 1);
  assert.deepEqual(readdirSync(dir), []);
});

test('a failed install keeps the project and says to run npm install in it', async () => {
  const starter = makeStarter({ templates: standardTemplates() });
  const dir = join(tmp(), 'my-app');
  const { io, err } = makeIo();
  io.install = () => {
    throw new Error('npm install failed.');
  };
  assert.equal(await run([dir, '--starter', starter, '--client', 'react', '--server', 'node'], io), 1);
  assert.equal(read(dir, 'server/src/main.ts'), 'node server');
  assert.match(err(), /run `npm install` in it/);
  assert.match(err(), /my-app/);
});

test('--starter with --ref, an empty --starter and extra positionals are refused', async () => {
  const starter = makeStarter({ templates: standardTemplates() });
  const base = ['--client', 'react', '--server', 'node', '--no-install'];
  const both = makeIo();
  assert.equal(await run([join(tmp(), 'a'), '--starter', starter, '--ref', 'main', ...base], both.io), 1);
  assert.match(both.err(), /--starter.*--ref|--ref.*--starter/);
  const empty = makeIo();
  assert.equal(await run([join(tmp(), 'a'), '--starter', '', ...base], empty.io), 1);
  assert.match(empty.err(), /--starter needs a path/);
  const extra = makeIo();
  assert.equal(await run([join(tmp(), 'a'), join(tmp(), 'b'), '--starter', starter, ...base], extra.io), 1);
  assert.match(extra.err(), /one project directory/);
});

test('a starter without templates/ is a usage error that names the path', async () => {
  const starter = tmp();
  const { io, err } = makeIo();
  assert.equal(await run([join(tmp(), 'a'), '--starter', starter, '--client', 'react', '--server', 'node'], io), 1);
  assert.match(err(), new RegExp(`${starter}.*no templates/`));
  assert.doesNotMatch(err(), /ENOENT/);
});

test('an existing empty target stays the same directory, so scaffolding into `.` works', async () => {
  const starter = makeStarter({ templates: standardTemplates() });
  const dir = tmp();
  const before = statSync(dir).ino;
  const { io } = makeIo();
  assert.equal(await run(['.', '--starter', starter, '--client', 'react', '--server', 'node', '--no-install'], { ...io, cwd: dir }), 0);
  assert.equal(statSync(dir).ino, before);
  assert.equal(read(dir, 'server/src/main.ts'), 'node server');
  assert.equal(readdirSync(dir).some((name) => name.startsWith('.')), false);
});
