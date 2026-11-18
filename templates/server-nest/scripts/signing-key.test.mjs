import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const serverDir = fileURLToPath(new URL('../server/', import.meta.url));

test('without the dev issuer and with an empty APP_SIGNING_KEY, boot exits and names the variable', async () => {
  const child = spawn(process.execPath, ['--import', '@swc-node/register/esm-register', 'src/main.ts'], {
    cwd: serverDir,
    env: {
      PATH: process.env.PATH,
      PUBLIC_BASE_URL: 'http://127.0.0.1:3101',
      APP_SIGNING_KEY: '',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));
  const [code] = await once(child, 'exit');
  assert.notEqual(code, 0);
  assert.match(stderr, /APP_SIGNING_KEY/);
});
