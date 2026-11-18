import type { IncomingMessage } from 'node:http';
import { assertPermission, readBearer, verifyUserToken } from '@vectoragents/vs-apps/server';
import { platform } from './platform';

export async function requirePermission(req: IncomingMessage, permission: string) {
  const claims = await verifyUserToken(platform.verifier, readBearer(req.headers));
  assertPermission(claims, permission);
  return claims;
}
