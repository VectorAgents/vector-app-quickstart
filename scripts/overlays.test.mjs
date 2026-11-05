import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { overlayDrift } from './overlay-drift.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

// Files an overlay replaces whole. Every other overlay file must equal its template counterpart.
const MAY_DIFFER = {
  'leads-app': [
    'client/src/App.tsx',
    'client/src/LeadsPage.tsx',
    'shared/src/index.ts',
    'scripts/definition.test.mjs',
  ],
};

for (const [overlay, allowed] of Object.entries(MAY_DIFFER)) {
  test(`overlays/${overlay} matches the templates except the allowed files`, () => {
    assert.deepEqual(overlayDrift(root, overlay, allowed), []);
  });
}
