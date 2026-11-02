import type { IncomingMessage, ServerResponse } from 'node:http';
import { DEV_APP_ID, type AppManifest } from '@vectoragents/vs-apps';
import { createDevIssuer, devTokenRequestSchema, readJsonBody } from '@vectoragents/vs-apps/server';

// Defined only in harness mode: createDevIssuer reads or creates a key file in the OS temp directory that every process on the machine shares.
export const devIssuer = process.env.VA_DEV_ISSUER === 'true' ? createDevIssuer() : undefined;

export const DEV_JWKS_PATH = '/api/__dev/jwks.json';

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export async function handleDevRoute(
  req: IncomingMessage,
  res: ServerResponse,
  manifests: Record<string, AppManifest>,
): Promise<boolean> {
  if (!devIssuer) return false;
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  if (req.method === 'GET' && pathname === '/api/__dev/manifests') {
    send(
      res,
      200,
      Object.values(manifests).map((manifest) => ({ appKey: manifest.appKey, appId: DEV_APP_ID, manifest })),
    );
    return true;
  }
  if (req.method === 'GET' && pathname === DEV_JWKS_PATH) {
    send(res, 200, devIssuer.jwks());
    return true;
  }
  if (req.method === 'POST' && pathname === '/api/__dev/token') {
    const parsed = devTokenRequestSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      send(res, 400, { error: `Invalid token request: ${parsed.error.message}` });
      return true;
    }
    send(res, 200, await devIssuer.sign(parsed.data));
    return true;
  }
  return false;
}
