import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bundledModuleUrl } from './compile.mjs';

const { featuredServices, featuredPlatforms } = await import(bundledModuleUrl('migration/sveltekit/src/lib/ip/home-status.ts'));

test('homepage initializes featured services from the actual catalog', () => {
  assert.deepEqual(featuredServices.map(item => item.id), ['9', '4', '10', '5', '0', '19', '15', '1']);
  assert.ok(featuredServices.every(item => item.name));
  assert.equal(new Set(featuredServices.map(item => item.id)).size, featuredServices.length);
});
test('homepage AI overview contains distinct valid probe domains', () => {
  assert.ok(featuredPlatforms.length >= 8);
  assert.equal(new Set(featuredPlatforms.map(item => item.domain)).size, featuredPlatforms.length);
  assert.ok(featuredPlatforms.every(item => new URL(`https://${item.domain}`).hostname === item.domain));
});
