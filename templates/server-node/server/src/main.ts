import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { CAPABILITY } from '@hello-app/shared';
import { AppAuthError } from '@vectoragents/vs-apps/server';
import { requireCapability } from './auth';
import { platform } from './platform';

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// The platform answers Fetch requests, so Node's request is bridged to one.
function toFetchRequest(req: IncomingMessage): Request {
  const method = req.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : (Readable.toWeb(req) as ReadableStream);
  return new Request(new URL(req.url ?? '/', 'http://localhost'), {
    method,
    headers: req.headers as Record<string, string>,
    body,
    duplex: 'half',
  } as RequestInit);
}

async function sendFetchResponse(res: ServerResponse, response: Response): Promise<void> {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  try {
    const handled = await platform.fetch(toFetchRequest(req));
    if (handled) return await sendFetchResponse(res, handled);
    if (pathname !== '/api/hello') return send(res, 404, { error: 'Not found' });
    const claims = await requireCapability(req, CAPABILITY);
    send(res, 200, { sub: claims.sub, spaceId: claims.spaceId });
  } catch (error) {
    if (error instanceof AppAuthError) return send(res, error.status, { error: error.message });
    send(res, 500, { error: 'Server error' });
  }
}).listen(Number(process.env.SERVER_PORT));

void platform.pingManifests();
