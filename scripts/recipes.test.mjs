import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const SDK = '@vectoragents/vs-apps';
const PACKAGES = ['package.json', 'client/package.json', 'server/package.json', 'shared/package.json'];
const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

const pins = (base) =>
  PACKAGES.flatMap((file) => {
    const manifest = read(`${base}${file}`);
    const version = { ...manifest.devDependencies, ...manifest.dependencies }[SDK];
    return version === undefined ? [] : [[file, version]];
  });

const rootPin = pins('')[0][1];
const folders = existsSync(new URL('../recipes', import.meta.url)) ? readdirSync(new URL('../recipes', import.meta.url)) : [];

test('the starter has the leads-app start folder', () => {
  assert.ok(folders.includes('leads-app'));
});

for (const folder of folders) {
  test(`recipes/${folder} pins the root SDK version in every package`, () => {
    const found = pins(`recipes/${folder}/`);
    assert.ok(found.length > 0);
    for (const [file, version] of found) assert.equal(version, rootPin, `recipes/${folder}/${file}`);
    const lock = read(`recipes/${folder}/package-lock.json`).packages[`node_modules/${SDK}`].version;
    assert.equal(lock, rootPin, `recipes/${folder}/package-lock.json`);
  });
}

// Files a recipe folder may differ from, or add to, the starter root.
const MAY_DIFFER = {
  'leads-app': {
    'client/src/App.tsx': 'routes to the leads page',
    'client/src/LeadsPage.tsx': 'the leads page exists only in the recipe',
    'shared/src/index.ts': 'declares the leads capability and its types',
    'scripts/definition.test.mjs': 'tests the leads definition',
  },
};

const bytes = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const tracked = (dir) =>
  execFileSync('git', ['ls-files', '-z', '--', dir], { cwd: new URL('..', import.meta.url), encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .map((path) => path.slice(dir.length));

for (const folder of folders) {
  test(`recipes/${folder} matches the starter root except the allowed files`, () => {
    const allowed = MAY_DIFFER[folder] ?? {};
    const files = tracked(`recipes/${folder}/`);
    for (const file of Object.keys(allowed)) assert.ok(files.includes(file), `stale allowlist entry ${file}`);
    const problems = files
      .filter((file) => !(file in allowed))
      .flatMap((file) => {
        if (!existsSync(new URL(`../${file}`, import.meta.url))) return [`${file} has no root counterpart`];
        return bytes(file).equals(bytes(`recipes/${folder}/${file}`)) ? [] : [`${file} drifted from the root`];
      });
    assert.deepEqual(problems, [], `recipes/${folder}`);
  });
}
