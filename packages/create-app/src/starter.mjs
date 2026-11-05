import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = 'VectorAgents/vector-app-quickstart';
const SCHEMA_VERSION = 1;

export class UsageError extends Error {}

const DOWNLOAD_TIMEOUT_MS = 60_000;

export const starterUrl = (ref) => `https://codeload.github.com/${REPO}/tar.gz/${ref.split('/').map(encodeURIComponent).join('/')}`;

/** Downloads a ref of the starter repo and returns the unpacked `dir` and the temp root to remove as `cleanup`. */
export async function downloadStarter(ref) {
  const unreachable = (error) => new Error(`Could not reach GitHub to download the templates for ref "${ref}": ${error.cause?.code ?? error.message}`);
  let response;
  try {
    response = await fetch(starterUrl(ref), { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  } catch (error) {
    throw unreachable(error);
  }
  if (!response.ok) throw new UsageError(`Could not download the templates for ref "${ref}" (HTTP ${response.status}).`);
  const dir = mkdtempSync(join(tmpdir(), 'create-app-'));
  try {
    let bytes;
    try {
      bytes = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw unreachable(error);
    }
    writeFileSync(join(dir, 'starter.tar.gz'), bytes);
    mkdirSync(join(dir, 'starter'));
    // Relative paths with `cwd`: GNU tar reads `C:\...` as host:path.
    const untar = spawnSync('tar', ['-xzf', 'starter.tar.gz', '-C', 'starter', '--strip-components=1', '--no-same-owner'], { cwd: dir });
    if (untar.error) throw new Error(`Could not run tar to unpack the templates: ${untar.error.message}`);
    if (untar.status !== 0) throw new Error(`Could not unpack the templates: ${untar.stderr.toString().trim()}`);
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }
  return { dir: join(dir, 'starter'), cleanup: dir };
}

function readManifest(file) {
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    throw new UsageError(
      `${file} uses manifest schemaVersion ${manifest.schemaVersion}; this CLI reads ${SCHEMA_VERSION}. Run \`npm create @vectoragents/app@latest\`.`,
    );
  }
  for (const [key, type] of [['row', 'string'], ['label', 'string'], ['needsShared', 'boolean']]) {
    if (typeof manifest[key] !== type) throw new Error(`${file}: "${key}" must be a ${type}.`);
  }
  return manifest;
}

/**
 * Every template directory that holds a `flavour.json`. A flavour is named by its directory,
 * `<row>-<name>`, and the name is the value of `--<row>`.
 */
export function loadFlavours(starterDir) {
  const root = join(starterDir, 'templates');
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, 'flavour.json')))
    .map((entry) => {
      const manifest = readManifest(join(root, entry.name, 'flavour.json'));
      if (!entry.name.startsWith(`${manifest.row}-`)) {
        throw new Error(`templates/${entry.name}: the directory name must start with "${manifest.row}-".`);
      }
      return { ...manifest, name: entry.name.slice(manifest.row.length + 1), dir: join(root, entry.name) };
    });
}

export function listStarts(starterDir) {
  const root = join(starterDir, 'overlays');
  const overlays = existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()) : [];
  return ['hello', ...overlays.map((entry) => entry.name)];
}
