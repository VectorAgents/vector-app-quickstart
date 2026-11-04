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

test('the workflow skips prereleases, checks the tag against the version, and runs both test suites first', () => {
  assert.match(workflow, /^\s+if:\s*\$\{\{\s*!github\.event\.release\.prerelease\s*\}\}/m);
  const steps = workflow.split(/^\s+- /m);
  const at = (pattern) => steps.findIndex((step) => pattern.test(step));
  const tag = at(/github\.event\.release\.tag_name/);
  const packageTests = at(/run:\s*npm test\b/);
  const rootTests = at(/run:\s*node --test scripts\/\*\.test\.mjs/);
  const publish = at(/run:\s*npm publish\b/);
  assert.ok(tag > 0 && tag < packageTests && packageTests < publish && rootTests > 0 && rootTests < publish);
  assert.match(steps[tag], /\$\{TAG#v\}/);
});

test('CI scopes the packages token to the scaffold step and skips the pair job on fork pull requests', () => {
  const ci = readFileSync(`${root}/.github/workflows/ci.yml`, 'utf8');
  const [, pairJob] = ci.split(/^  pair:\n/m);
  assert.match(pairJob, /^    if:.*head\.repo\.full_name == github\.repository/m);
  assert.doesNotMatch(pairJob, /^    env:/m);
  const scaffold = pairJob.split(/^      - /m).find((step) => step.includes('create-app.mjs'));
  assert.match(scaffold, /GITHUB_PACKAGES_TOKEN:\s*\$\{\{\s*secrets\.PACKAGES_TOKEN\s*\}\}/);
  assert.equal(pairJob.match(/GITHUB_PACKAGES_TOKEN/g).length, 1);
});

test('dependabot watches every template package directory and no recipes', () => {
  const dependabot = readFileSync(`${root}/.github/dependabot.yml`, 'utf8');
  const listed = [...dependabot.matchAll(/^\s+- (\/\S+)$/gm)].map((match) => match[1]);
  const packages = execFileSync('git', ['ls-files', 'templates/**/package.json', 'packages/*/package.json'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((file) => `/${file.replace(/\/package\.json$/, '')}`);
  assert.deepEqual([...listed].sort(), [...packages].sort());
});
