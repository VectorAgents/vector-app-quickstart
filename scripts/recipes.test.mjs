import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const MAY_DIFFER = {
  'leads-app': [
    'client/src/App.tsx',
    'client/src/LeadsPage.tsx',
    'shared/src/index.ts',
    'scripts/definition.test.mjs',
  ],
};

const TEMPLATES = ['base', 'client-react', 'server-node', 'shared'];

const bytes = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const templateOf = (file) => TEMPLATES.map((name) => `templates/${name}/${file}`).find((path) => existsSync(new URL(`../${path}`, import.meta.url)));
const tracked = (dir) =>
  execFileSync('git', ['ls-files', '-z', '--', dir], { cwd: new URL('..', import.meta.url), encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .map((path) => path.slice(dir.length));

for (const folder of readdirSync(new URL('../recipes', import.meta.url))) {
  test(`recipes/${folder} matches the templates except the allowed files`, () => {
    const allowed = MAY_DIFFER[folder] ?? [];
    const files = tracked(`recipes/${folder}/`).filter((file) => file !== 'package-lock.json');
    for (const file of allowed) assert.ok(files.includes(file), `stale allowlist entry ${file}`);
    const problems = files
      .filter((file) => !allowed.includes(file))
      .flatMap((file) => {
        const counterpart = templateOf(file);
        if (!counterpart) return [`${file} has no template counterpart`];
        return bytes(counterpart).equals(bytes(`recipes/${folder}/${file}`)) ? [] : [`${file} drifted from ${counterpart}`];
      });
    assert.deepEqual(problems, [], `recipes/${folder}`);
  });
}
