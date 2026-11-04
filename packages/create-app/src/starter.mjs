import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = 'VectorAgents/vector-app-quickstart';
const SCHEMA_VERSION = 1;

export class UsageError extends Error {}

export const starterUrl = (ref) => `https://codeload.github.com/${REPO}/tar.gz/${ref}`;

/** Downloads a ref of the starter repo into a new temp directory and returns it. */
export async function downloadStarter(ref) {
  const response = await fetch(starterUrl(ref));
  if (!response.ok) throw new UsageError(`Could not download the templates for ref "${ref}" (HTTP ${response.status}).`);
  const dir = mkdtempSync(join(tmpdir(), 'create-app-'));
  const archive = join(dir, 'starter.tar.gz');
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  const extracted = join(dir, 'starter');
  mkdirSync(extracted);
  const untar = spawnSync('tar', ['-xzf', archive, '-C', extracted, '--strip-components=1']);
  if (untar.status !== 0) throw new Error(`Could not unpack the templates: ${untar.stderr}`);
  return { dir: extracted, cleanup: dir };
}

function readManifest(file) {
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    throw new UsageError(
      `${file} uses manifest schemaVersion ${manifest.schemaVersion}; this CLI reads ${SCHEMA_VERSION}. Run \`npm create @vectoragents/app@latest\`.`,
    );
  }
  for (const [key, type] of [['row', 'string'], ['label', 'string'], ['dev', 'string'], ['needsShared', 'boolean']]) {
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
