import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { hasValidUpdate } from '../migration/sveltekit/src/lib/update-version.ts';

test('new build is confirmed with a fresh SvelteKit version manifest', async () => {
  const original = globalThis.fetch;
  const signal = new AbortController().signal;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/_app/version.json');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, signal);
    return Response.json({ version: 'new' });
  };
  try {
    assert.equal(await hasValidUpdate('/_app/version.json', 'old', signal), true);
    assert.equal(await hasValidUpdate('/_app/version.json', 'new', signal), false);
  } finally { globalThis.fetch = original; }
});

test('missing, invalid and unavailable manifests never raise a notice', async () => {
  const original = globalThis.fetch;
  try {
    for (const response of [new Response('not found', { status: 404 }), Response.json({}), Response.json({ version: '' }), Response.json({ version: 12 }), new Response('invalid')]) {
      globalThis.fetch = async () => response;
      assert.equal(await hasValidUpdate('/_app/version.json', 'old', new AbortController().signal), false);
    }
    globalThis.fetch = async () => { throw new TypeError('offline'); };
    assert.equal(await hasValidUpdate('/_app/version.json', 'old', new AbortController().signal), false);
  } finally { globalThis.fetch = original; }
});

test('SvelteKit outputs its version manifest with a nonempty version', () => {
  const data = JSON.parse(readFileSync('dist/_app/version.json', 'utf8'));
  assert.equal(typeof data.version, 'string');
  assert.ok(data.version.length > 0);
});
