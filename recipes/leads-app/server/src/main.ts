import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { CAPABILITY } from '@hello-app/shared';
import { AppAuthError } from '@vectoragents/vs-apps/server';
import { requireCapability, requireProvisioning } from './auth';
import { DEV_JWKS_PATH, devIssuer, handleDevRoute } from './dev-routes';
import { manifests } from './manifests';

type Route = (req: IncomingMessage) => Promise<unknown>;

const routes: Record<string, Route> = {
  '/api/client-config': async () => ({
    allowedParentOrigin: process.env.ALLOWED_PARENT_ORIGIN,
    spaceJwksUrl: devIssuer ? DEV_JWKS_PATH : process.env.SPACE_JWKS_URL,
  }),
  '/api/manifest/hello-app': async (req) => {
    await requireProvisioning(req);
    return manifests['hello-app'];
  },
  '/api/hello': async (req) => {
    const claims = await requireCapability(req, CAPABILITY);
    return { sub: claims.sub, spaceId: claims.spaceId };
  },
  '/api/provision': async (req) => {
    await requireProvisioning(req);
    return { ok: true };
  },
  '/api/deprovision': async (req) => {
    await requireProvisioning(req);
    return { ok: true };
  },
};

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const route = routes[pathname];
  try {
    if (await handleDevRoute(req, res, manifests)) return;
    if (!route) return send(res, 404, { error: 'Not found' });
    send(res, 200, await route(req));
  } catch (error) {
    if (error instanceof AppAuthError) return send(res, error.status, { error: error.message });
    send(res, 500, { error: 'Server error' });
  }
}).listen(Number(process.env.SERVER_PORT));
