import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => readFileSync(path);
const filesUnder = (dir) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1));

/**
 * Lists how `overlays/<overlay>` breaks the drift rule: a file outside `allowed` must equal its
 * counterpart in a template. Counterpart templates are every directory under `templates/`.
 */
export function overlayDrift(starterDir, overlay, allowed) {
  const overlayDir = join(starterDir, 'overlays', overlay);
  const templatesDir = join(starterDir, 'templates');
  const templates = readdirSync(templatesDir);
  const counterpartOf = (file) =>
    templates.map((name) => `templates/${name}/${file}`).find((path) => existsSync(join(starterDir, path)));

  const files = filesUnder(overlayDir);
  const stale = allowed.filter((file) => !files.includes(file)).map((file) => `stale allowlist entry ${file}`);
  const drifted = files
    .filter((file) => !allowed.includes(file))
    .flatMap((file) => {
      const counterpart = counterpartOf(file);
      if (!counterpart) return [`${file} has no template counterpart`];
      return read(join(starterDir, counterpart)).equals(read(join(overlayDir, file))) ? [] : [`${file} drifted from ${counterpart}`];
    });
  return [...stale, ...drifted];
}
