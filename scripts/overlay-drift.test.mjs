import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { overlayDrift } from './overlay-drift.mjs';

function starter({ templates, overlay }) {
  const root = mkdtempSync(join(tmpdir(), 'overlay-drift-'));
  const write = (base, files) => {
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, base, path)), { recursive: true });
      writeFileSync(join(root, base, path), content);
    }
  };
  for (const [name, files] of Object.entries(templates)) write(`templates/${name}`, files);
  write('overlays/o', overlay);
  return root;
}

const templates = { base: { 'a.txt': 'a' }, 'client-react': { 'client/b.txt': 'b' } };

test('no problems when only allowed files differ or are new', () => {
  const root = starter({ templates, overlay: { 'a.txt': 'changed', 'new.txt': 'n', 'client/b.txt': 'b' } });
  assert.deepEqual(overlayDrift(root, 'o', ['a.txt', 'new.txt']), []);
});

test('a file outside the allowed set that differs from its counterpart is reported', () => {
  const root = starter({ templates, overlay: { 'client/b.txt': 'changed' } });
  assert.deepEqual(overlayDrift(root, 'o', []), ['client/b.txt drifted from templates/client-react/client/b.txt']);
});

test('a file outside the allowed set with no counterpart is reported', () => {
  const root = starter({ templates, overlay: { 'extra.txt': 'x' } });
  assert.deepEqual(overlayDrift(root, 'o', []), ['extra.txt has no template counterpart']);
});

test('an allowed file that the overlay does not hold is reported', () => {
  const root = starter({ templates, overlay: { 'a.txt': 'a' } });
  assert.deepEqual(overlayDrift(root, 'o', ['a.txt', 'gone.txt']), ['stale allowlist entry gone.txt']);
});
