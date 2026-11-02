import assert from 'node:assert/strict';
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
