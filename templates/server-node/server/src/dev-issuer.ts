import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDevIssuer } from '@vectoragents/vs-apps/server';

// The issuer stores nothing. The key file lives in the OS temp directory, which every process on the machine shares, so restarts of the dev runner keep live tokens valid.
const KEY_PATH = join(tmpdir(), 'hello-app-dev-issuer.pem');

export async function loadDevIssuer() {
  const privateKey = existsSync(KEY_PATH) ? readFileSync(KEY_PATH, 'utf8') : undefined;
  const issuer = await createDevIssuer(privateKey ? { privateKey } : {});
  if (!privateKey) writeFileSync(KEY_PATH, issuer.privateKey, { mode: 0o600 });
  return issuer;
}
