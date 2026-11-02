import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { mergeExtractedCatalog } from '@vectoragents/vs-apps/server';

const catalogPath = new URL('../server/agent-catalog.json', import.meta.url);

test('the starter ships an empty agent catalog with exact content', () => {
  assert.equal(readFileSync(catalogPath, 'utf8'), '{"pages":[],"actions":[]}');
});

test('the SDK reads the shipped catalog without a missing-file warning', () => {
  const logs = [];
  mergeExtractedCatalog({}, { path: catalogPath.pathname, log: (message) => logs.push(message) });
  assert.deepEqual(logs, []);
});
