import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const serverDir = fileURLToPath(new URL('../server/', import.meta.url));

// Boot must fail fast: a child that outlives the timeout fails the test and is killed.
async function bootFailure(signingKey) {
  const child = spawn(process.execPath, ['--import', '@swc-node/register/esm-register', 'src/main.ts'], {
    cwd: serverDir,
    env: {
      PATH: process.env.PATH,
      PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
      APP_SIGNING_KEY: signingKey,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('boot did not exit within 20s')), 20_000);
  });
  try {
    const [code] = await Promise.race([once(child, 'exit'), timeout]);
    return { code, stderr };
  } finally {
    clearTimeout(timer);
    child.kill();
  }
}

for (const [label, value] of [['empty', ''], ['malformed', 'not json']]) {
  test(`without the dev issuer and with a ${label} APP_SIGNING_KEY, boot exits and names the variable`, async () => {
    const { code, stderr } = await bootFailure(value);
    assert.notEqual(code, 0);
    assert.match(stderr, /APP_SIGNING_KEY/);
  });
}
