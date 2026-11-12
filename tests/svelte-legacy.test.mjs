import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bundledModuleUrl } from './compile.mjs';

const { legacyDestination } = await import(bundledModuleUrl('migration/sveltekit/src/lib/legacy.ts'));

test('legacy routes preserve IP parameters and user query', () => {
  assert.equal(legacyDestination(new URL('https://example.test/network/ip/2001%3Adb8%3A%3A1#details')), '/zh/ip/2001%3Adb8%3A%3A1#details');
  assert.equal(legacyDestination(new URL('https://example.test/lookup/whois?q=example.com')), '/zh/whois?q=example.com');
  assert.equal(legacyDestination(new URL('https://example.test/status/openai')), '/zh/status?service=9');
  assert.equal(legacyDestination(new URL('https://example.test/en/network/ip/2001%3Adb8%3A%3A1#details')), '/en/ip/2001%3Adb8%3A%3A1#details');
  assert.equal(legacyDestination(new URL('https://example.test/en/status/openai')), '/en/status?service=9');
  assert.equal(legacyDestination(new URL('https://example.test/zh/lookup/whois?q=example.com')), '/zh/whois?q=example.com');
  assert.equal(legacyDestination(new URL('https://example.test/missing')), undefined);
});
