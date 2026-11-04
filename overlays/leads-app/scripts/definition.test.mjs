import assert from 'node:assert/strict';
import { test } from 'node:test';
import { definition } from '../shared/src/index.ts';

test('the app definition has an ungated leads page', () => {
  const leads = definition.pages.find((page) => page.key === 'leads');
  assert.ok(leads);
  assert.equal(leads.path, '/leads');
  assert.equal(leads.capability, undefined);
});

test('the app definition declares the shared recipe capabilities', () => {
  assert.equal(definition.key, 'hello-app');
  const keys = definition.capabilities.map((capability) => capability.key);
  assert.ok(keys.includes('lead:manage'));
  assert.ok(keys.includes('icp:manage'));
});
