import type { IncomingMessage } from 'node:http';
import { assertCapability, readBearer, verifyUserToken } from '@vectoragents/vs-apps/server';
import { platform } from './platform';

export async function requireCapability(req: IncomingMessage, capability: string) {
  const claims = await verifyUserToken(platform.verifier, readBearer(req.headers));
  assertCapability(claims, capability);
  return claims;
}
