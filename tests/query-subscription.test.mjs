import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bundledModuleUrl } from './compile.mjs';

const { testConnectivity } = await import(bundledModuleUrl('migration/sveltekit/src/lib/ip/connectivity.ts'));

test('progress snapshots do not mutate previous results', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });
  try {
    const progress = [];
    await testConnectivity('https://example.test', undefined, value => progress.push(value));
    assert.deepEqual(progress.map(item => item.samples.length), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(progress[0].samples, []);
    assert.ok(progress.at(-1).median >= 0);
  } finally { globalThis.fetch = original; }
});

test('cancelled probes do not publish stale progress after a replacement starts', async () => {
  const original = globalThis.fetch;
  const old = new AbortController();
  let release;
  const oldResponse = new Promise(resolve => { release = resolve; });
  let count = 0;
  globalThis.fetch = async () => ++count === 1 ? oldResponse : new Response(null, { status: 204 });
  try {
    const previous = [];
    const first = testConnectivity('https://example.test', old.signal, value => previous.push(value));
    old.abort();
    const next = [];
    const replacement = testConnectivity('https://example.test', undefined, value => next.push(value));
    release(new Response(null, { status: 204 }));
    await assert.rejects(first, { name: 'AbortError' });
    await replacement;
    assert.equal(previous.length, 1);
    assert.equal(next.at(-1).samples.length, 8);
  } finally { globalThis.fetch = original; }
});
