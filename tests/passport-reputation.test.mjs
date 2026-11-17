import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';

const bundle = buildSync({
  entryPoints: ['migration/sveltekit/src/lib/passport/reputation.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  write: false,
});
const { passportReputation } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);

test('reputation and exit types use the selected IP and preserve unknown data', async (t) => {
  const ip = '1.1.1.1';
  let source;
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(String(url), `https://ip.net.coffee/api/ip/lookup/${ip}`);
    return new Response(JSON.stringify({ ip, ...source }), { status: 200 });
  });
  const signal = new AbortController().signal;
  const cases = [
    [{ trust_score: 85, is_datacenter: true }, { reputationScore: 85, exitType: 'datacenter', reputationSource: 'Net.Coffee' }],
    [{ trust_score: 96, isResidential: true }, { reputationScore: 96, exitType: 'residential', reputationSource: 'Net.Coffee' }],
    [{ trust_score: 0, is_mobile: true, isResidential: true }, { reputationScore: 0, exitType: 'mobile', reputationSource: 'Net.Coffee' }],
    [{ trust_score: 101, isResidential: true, is_datacenter: true }, { reputationScore: undefined, exitType: 'conflict', reputationSource: 'Net.Coffee' }],
    [{ is_public_service: true, isResidential: true, is_datacenter: true }, { reputationScore: undefined, exitType: 'public-service', reputationSource: 'Net.Coffee' }],
    [{}, { reputationScore: undefined, exitType: undefined, reputationSource: 'Net.Coffee' }],
  ];
  for (const [input, expected] of cases) {
    source = input;
    assert.deepEqual(await passportReputation(ip, signal), expected);
  }
});
