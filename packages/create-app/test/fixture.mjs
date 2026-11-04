import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PassThrough } from 'node:stream';

export const tmp = () => mkdtempSync(join(tmpdir(), 'create-app-test-'));

function write(root, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), typeof content === 'string' ? content : JSON.stringify(content));
  }
}

export const manifest = (extra) => ({
  schemaVersion: 1,
  row: 'client',
  label: 'Label',
  dev: 'dev-command',
  needsShared: true,
  ...extra,
});

/** A starter checkout: `templates` and `overlays` map a directory name to its files. */
export function makeStarter({ templates, overlays = {} }) {
  const root = tmp();
  for (const [name, files] of Object.entries(templates)) write(join(root, 'templates', name), files);
  for (const [name, files] of Object.entries(overlays)) write(join(root, 'overlays', name), files);
  return root;
}

export const standardTemplates = () => ({
  base: { 'package.json': '{"name":"base"}', 'scripts/dev.mjs': 'base dev' },
  shared: { 'shared/src/index.ts': 'shared code' },
  'client-react': {
    'flavour.json': manifest({ row: 'client', label: 'React', default: true }),
    'client/src/App.tsx': 'react app',
  },
  'client-vue': {
    'flavour.json': manifest({ row: 'client', label: 'Vue', needsShared: false }),
    'client/src/App.vue': 'vue app',
  },
  'server-node': {
    'flavour.json': manifest({ row: 'server', label: 'Node.js', default: true }),
    'server/src/main.ts': 'node server',
  },
  'server-nest': {
    'flavour.json': manifest({ row: 'server', label: 'Nest.js' }),
    'server/src/main.ts': 'nest server',
  },
});

export function withManifest(templates, name, patch) {
  const manifestFile = templates[name]['flavour.json'];
  return { ...templates, [name]: { ...templates[name], 'flavour.json': { ...manifestFile, ...patch } } };
}

/** Test io: `answers` are the lines a person types; `tty` says whether a person is there. */
export function makeIo({ tty = false, answers = [] } = {}) {
  const stdin = new PassThrough();
  for (const line of answers) stdin.write(`${line}\n`);
  const out = [];
  const err = [];
  const installs = [];
  const io = {
    stdin,
    isTTY: tty,
    stdout: { write: (text) => out.push(text) },
    stderr: { write: (text) => err.push(text) },
    install: (dir) => installs.push(dir),
  };
  return { io, installs, out: () => out.join(''), err: () => err.join('') };
}
