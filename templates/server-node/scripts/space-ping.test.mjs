import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const serverDir = fileURLToPath(new URL('../server/', import.meta.url));

async function freePort() {
  const probe = createServer().listen(0);
  await once(probe, 'listening');
  const { port } = probe.address();
  probe.close();
  await once(probe, 'close');
  return port;
}

async function startFakeSpace() {
  const pings = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      pings.push({ method: req.method, url: req.url, body: JSON.parse(body || '{}') });
      res.writeHead(200).end();
    });
  }).listen(0);
  await once(server, 'listening');
  return { pings, origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

async function bootStarter(extraEnv) {
  const port = await freePort();
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: serverDir,
    env: {
      PATH: process.env.PATH,
      SERVER_PORT: String(port),
      PUBLIC_BASE_URL: `http://127.0.0.1:${port}`,
      ALLOWED_PARENT_ORIGIN: 'http://localhost:5173',
      SPACE_JWKS_URL: 'http://127.0.0.1:1/jwks.json',
      ...extraEnv,
    },
    stdio: 'ignore',
  });
  const url = `http://127.0.0.1:${port}/api/client-config`;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      return { child, config: await (await fetch(url)).json() };
    } catch {
      await sleep(100);
    }
  }
  child.kill();
  throw new Error('starter did not boot');
}

test('with SPACE_API_URL set, boot pings Space once and client-config returns spaceApiUrl', async () => {
  const space = await startFakeSpace();
  const spaceApiUrl = `${space.origin}/api`;
  const { child, config } = await bootStarter({ SPACE_API_URL: spaceApiUrl });
  try {
    for (let attempt = 0; attempt < 50 && space.pings.length === 0; attempt++) await sleep(100);
    assert.equal(config.spaceApiUrl, spaceApiUrl);
    assert.equal(space.pings.length, 1);
    assert.equal(space.pings[0].method, 'POST');
    assert.equal(space.pings[0].url, '/api/apps/manifest-ping');
    assert.equal(space.pings[0].body.appKey, 'hello-app');
  } finally {
    child.kill();
    space.close();
  }
});

test('with SPACE_API_URL unset, boot succeeds and client-config omits spaceApiUrl', async () => {
  const { child, config } = await bootStarter({});
  try {
    assert.equal('spaceApiUrl' in config, false);
  } finally {
    child.kill();
  }
});
