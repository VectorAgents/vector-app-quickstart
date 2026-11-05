import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { run } from '../src/cli.mjs';
import { downloadStarter, starterUrl } from '../src/starter.mjs';
import { makeIo, makeStarter, standardTemplates, tmp } from './fixture.mjs';

/** A tar.gz of `dir`, nested under a top-level folder the way GitHub archives are. */
function archiveOf(dir) {
  const parent = tmp();
  cpSync(dir, join(parent, 'repo-main'), { recursive: true });
  execFileSync('tar', ['-czf', join(parent, 'a.tar.gz'), '-C', parent, 'repo-main']);
  return readFileSync(join(parent, 'a.tar.gz'));
}

async function withFetch(fetchStub, body) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchStub;
  try {
    return await body();
  } finally {
    globalThis.fetch = original;
  }
}

const okResponse = (bytes) => async () => new Response(bytes, { status: 200 });
const leftovers = () => readdirSync(tmpdir()).filter((name) => name.startsWith('create-app-') && !name.startsWith('create-app-test-'));

test('starterUrl encodes each segment of the ref and keeps its slashes', () => {
  assert.equal(starterUrl('main'), 'https://codeload.github.com/VectorAgents/vector-app-quickstart/tar.gz/main');
  assert.equal(starterUrl('feature/a b#c'), 'https://codeload.github.com/VectorAgents/vector-app-quickstart/tar.gz/feature/a%20b%23c');
});

test('downloadStarter unpacks the archive without its top-level folder', async () => {
  const bytes = archiveOf(makeStarter({ templates: standardTemplates() }));
  const { dir, cleanup } = await withFetch(okResponse(bytes), () => downloadStarter('main'));
  try {
    assert.equal(existsSync(join(dir, 'templates/base/package.json')), true);
  } finally {
    rmSync(cleanup, { recursive: true, force: true });
  }
});

test('a network failure names the ref and the cause', async () => {
  const stub = async () => {
    throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
  };
  await assert.rejects(withFetch(stub, () => downloadStarter('main')), /ref "main".*ENOTFOUND/);
});

test('a body that fails mid-download names the ref and leaves no temp directory', async () => {
  const before = leftovers().length;
  const body = new ReadableStream({ start: (controller) => controller.error(new TypeError('terminated')) });
  await assert.rejects(withFetch(async () => new Response(body, { status: 200 }), () => downloadStarter('main')), /ref "main".*terminated/);
  assert.equal(leftovers().length, before);
});

test('fetch gets a timeout signal', async () => {
  let signal;
  const stub = async (_url, options) => {
    signal = options?.signal;
    return new Response('x', { status: 404 });
  };
  await assert.rejects(withFetch(stub, () => downloadStarter('main')), /HTTP 404/);
  assert.ok(signal instanceof AbortSignal);
});

test('a missing tar names the problem and leaves no temp directory', async () => {
  const before = leftovers().length;
  const path = process.env.PATH;
  process.env.PATH = '';
  try {
    await assert.rejects(withFetch(okResponse(Buffer.from('x')), () => downloadStarter('main')), /Could not run tar/);
  } finally {
    process.env.PATH = path;
  }
  assert.equal(leftovers().length, before);
});

test('a corrupt archive reports tar output and leaves no temp directory', async () => {
  const before = leftovers().length;
  await assert.rejects(withFetch(okResponse(Buffer.from('not a tarball')), () => downloadStarter('main')), /Could not unpack the templates/);
  assert.equal(leftovers().length, before);
});

test('--ref goes through the encoded URL, and a ref without templates/ is a usage error naming it', async () => {
  const empty = makeStarter({ templates: { 'x': { 'a.txt': 'a' } } });
  rmSync(join(empty, 'templates'), { recursive: true });
  const bytes = archiveOf(empty);
  let url;
  const stub = async (requested) => {
    url = requested;
    return new Response(bytes, { status: 200 });
  };
  const { io, err } = makeIo();
  const code = await withFetch(stub, () => run([join(tmp(), 'a'), '--ref', 'old/ref?', '--client', 'react', '--server', 'node'], io));
  assert.equal(code, 1);
  assert.match(url, /tar\.gz\/old\/ref%3F$/);
  assert.match(err(), /ref "old\/ref\?".*no templates\//);
  assert.doesNotMatch(err(), /ENOENT/);
});
