import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkgDir = `${root}/packages/create-app`;
const manifest = JSON.parse(readFileSync(`${pkgDir}/package.json`, 'utf8'));
const workflow = readFileSync(`${root}/.github/workflows/publish.yml`, 'utf8');

test('the manifest targets GitHub Packages and links the package to this repo', () => {
  assert.equal(manifest.name, '@vectoragents/create-app');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.publishConfig.registry, 'https://npm.pkg.github.com');
  assert.equal(manifest.repository.url, 'git+https://github.com/VectorAgents/vector-app-quickstart.git');
  assert.equal(manifest.repository.directory, 'packages/create-app');
});

test('the tarball holds the bin and sources and no tests', () => {
  const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: pkgDir, encoding: 'utf8' }));
  const paths = pack.files.map((file) => file.path);
  assert.ok(paths.includes('bin/create-app.mjs'));
  assert.ok(paths.includes('src/cli.mjs'));
  assert.deepEqual(paths.filter((path) => path.startsWith('test/')), []);
});

test('the workflow publishes on release with the job token', () => {
  assert.match(workflow, /^on:\s*\n\s+release:\s*\n\s+types:\s*\[published\]/m);
  assert.match(workflow, /^\s+packages:\s*write\s*$/m);
  assert.match(workflow, /registry-url:\s*https:\/\/npm\.pkg\.github\.com/);
  assert.match(workflow, /scope:\s*'?@vectoragents'?/);
  assert.match(workflow, /NODE_AUTH_TOKEN:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/);
  assert.match(workflow, /run:\s*npm publish\b/);
});
