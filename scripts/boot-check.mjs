// Usage: node scripts/boot-check.mjs <project-dir> <server>
// On Nest, a canary route with type-only constructor injection fails when the runner emits no decorator metadata.
import { spawn } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const PORT = 3101;
const BOOT_TIMEOUT_MS = 90_000;
const url = (path) => `http://127.0.0.1:${PORT}${path}`;

async function reachable() {
  try {
    await fetch(url('/api/client-config'));
    return true;
  } catch {
    return false;
  }
}

async function waitFor(condition, timeoutMs) {
  for (const deadline = Date.now() + timeoutMs; Date.now() < deadline; await sleep(250)) {
    if (await condition()) return true;
  }
  return false;
}

async function request(path) {
  const response = await fetch(url(path));
  return { status: response.status, body: await response.text() };
}

function addNestCanary(project) {
  const canary = fileURLToPath(new URL('./boot-canary/nest.ts', import.meta.url));
  copyFileSync(canary, join(project, 'server/src/canary.ts'));
  const modulePath = join(project, 'server/src/app.module.ts');
  const source = readFileSync(modulePath, 'utf8');
  const patched = source
    .replace("import { Module } from '@nestjs/common';", "import { Module } from '@nestjs/common';\nimport { CanaryModule } from './canary';")
    .replace('imports: [', 'imports: [\n    CanaryModule,');
  if (patched === source || !patched.includes('CanaryModule,')) throw new Error('app.module.ts did not accept the canary');
  writeFileSync(modulePath, patched);
}

async function bootAndRequest(project, script, requests) {
  if (await reachable()) throw new Error(`Port ${PORT} is already in use`);
  let log = '';
  const child = spawn('npm', ['run', script], { cwd: project, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => (log += chunk));
  let exited = false;
  child.on('exit', () => (exited = true));
  try {
    const booted = await waitFor(async () => !exited && (await reachable()), BOOT_TIMEOUT_MS);
    if (!booted) throw new Error(`${script}: the server did not come up`);
    for (const { path, status, includes } of requests) {
      const result = await request(path);
      if (result.status !== status || (includes && !result.body.includes(includes))) {
        throw new Error(`${script}: GET ${path} returned ${result.status} ${result.body}; expected ${status}${includes ? ` containing ${includes}` : ''}`);
      }
      console.log(`${script}: GET ${path} -> ${result.status}`);
    }
  } catch (error) {
    console.error(log.split('\n').slice(-40).join('\n'));
    throw error;
  } finally {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
    if (!(await waitFor(async () => !(await reachable()), 15_000))) throw new Error(`${script}: the server did not stop`);
  }
}

const [project, server] = process.argv.slice(2);
if (!project || !server) {
  console.error('Usage: node scripts/boot-check.mjs <project-dir> <server>');
  process.exit(2);
}

const requests = [{ path: '/api/client-config', status: 200 }];
if (server === 'nest') {
  addNestCanary(project);
  requests.push({ path: '/api/canary', status: 200, includes: '"injected":true' });
}

copyFileSync(join(project, '.env.example'), join(project, '.env'));
await bootAndRequest(project, 'dev', requests);
await bootAndRequest(project, 'dev:space', requests);
console.log(`${server}: boots in dev and dev:space`);
