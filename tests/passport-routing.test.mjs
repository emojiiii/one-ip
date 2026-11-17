import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';

const result = buildSync({ entryPoints: ['migration/sveltekit/src/lib/passport/routing.ts'], bundle: true, platform: 'node', format: 'esm', target: 'node24', write: false });
const { collectRouting, summarizeRouting } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
const geo = (ip, country_code) => ({ ip, country_code });
const site = (name, status, ip, type = 'international') => ({ name, type, status, ...(ip ? { ip } : {}) });

test('compares IPv4 references without exposing addresses and counts partial results', () => {
  const summary = summarizeRouting(geo('1.1.1.1', 'CN'), geo('8.8.8.8', 'US'), [
    site('domestic', 'observed', '1.1.1.1', 'domestic'),
    site('overseas', 'observed', '8.8.8.8'),
    site('other', 'observed', '9.9.9.9'),
    site('v6', 'observed', '2606:4700:4700::1111'),
    site('no response', 'unavailable'), site('unsupported', 'unsupported'), site('not started', 'not-attempted'),
  ]);
  assert.equal(summary.comparison, 'different');
  assert.equal(summary.sites.total, 7);
  assert.equal(summary.sites.attempted, 5);
  assert.equal(summary.sites.observed, 4);
  assert.equal(summary.sites.unavailable, 1);
  assert.equal(summary.sites.unsupported, 1);
  assert.equal(summary.sites.notAttempted, 1);
  assert.equal(summary.sites.ipv4Observed, 3);
  assert.equal(summary.sites.ipv4Exits, 3);
  assert.equal(summary.sites.ipv6Observed, 1);
  assert.equal(summary.sites.ipv6Exits, 1);
  assert.equal(summary.sites.domesticMatches, 1);
  assert.equal(summary.sites.overseasMatches, 1);
  assert.equal(summary.sites.otherMatches, 1);
  assert.equal(summary.sites.unclassified, 1);
  assert.equal(summary.sites.details.find((item) => item.name === 'v6').route, 'unknown');
  assert.doesNotMatch(JSON.stringify(summary), /1\.1\.1\.1|8\.8\.8\.8|9\.9\.9\.9|2606:/);
});

test('one unavailable reference prevents false routing classifications', () => {
  const summary = summarizeRouting(geo('1.1.1.1', 'CN'), undefined, [site('test', 'observed', '1.1.1.1')]);
  assert.equal(summary.comparison, 'unknown');
  assert.equal(summary.domestic.status, 'observed');
  assert.equal(summary.overseas.status, 'unavailable');
  assert.equal(summary.sites.details[0].route, 'unknown');
  assert.equal(summary.sites.ipv4Observed, 1);
  assert.equal(summary.sites.ipv4Exits, 1);
});

test('matching references use both category and dual stack remains separated', () => {
  const summary = summarizeRouting(geo('1.1.1.1', 'CN'), geo('1.1.1.1', 'CN'), [
    site('v4', 'observed', '1.1.1.1'),
    site('v6a', 'observed', '2001:4860:4860::8888'),
    site('v6b', 'observed', '2001:4860:4860:0:0:0:0:8888'),
  ]);
  assert.equal(summary.comparison, 'same');
  assert.equal(summary.sites.bothMatches, 1);
  assert.equal(summary.sites.ipv4Observed, 1);
  assert.equal(summary.sites.ipv4Exits, 1);
  assert.equal(summary.sites.ipv6Observed, 2);
  assert.equal(summary.sites.ipv6Exits, 1);
});

test('an externally canceled collection stops before issuing probes', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch');
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(collectRouting(controller.signal), { name: 'AbortError' });
  assert.equal(fetch.mock.callCount(), 0);
});

test('collects independent reference exits and a bounded website sample', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = String(input);
    if (url.includes('necaptcha.nosdn.127.net')) return new Response(null, { headers: { 'cdn-user-ip': '1.1.1.1' } });
    if (url.includes('perfops.byte-test.com')) return new Response(null, { headers: { 'x-request-ip': '1.1.1.1' } });
    if (url.includes('api4.ipify.org')) return Response.json({ ip: '8.8.8.8' });
    if (url.includes('api.ipquery.io/')) {
      const ip = url.includes('1.1.1.1') ? '1.1.1.1' : '8.8.8.8';
      return Response.json({ ip, location: { country: ip === '1.1.1.1' ? 'China' : 'Japan', country_code: ip === '1.1.1.1' ? 'CN' : 'JP' } });
    }
    if (url.includes('ipwho.is/')) {
      const ip = url.includes('1.1.1.1') ? '1.1.1.1' : '8.8.8.8';
      return Response.json({ success: true, ip, country: ip === '1.1.1.1' ? 'China' : 'Japan', country_code: ip === '1.1.1.1' ? 'CN' : 'JP' });
    }
    if (url.includes('my.ip.cn')) return new Response('IP地址: 1.1.1.1');
    if (url.includes('api.ip.sb/jsonip')) return Response.json({ ip: '8.8.8.8' });
    if (url.includes('www.cloudflare-cn.com')) return new Response('ip=1.1.1.1\nloc=CN');
    if (url.includes('chatgpt.com')) return new Response('ip=8.8.8.8\nloc=JP');
    if (url.includes('x.com')) return new Response('ip=9.9.9.9\nloc=US');
    if (url.includes('www.cloudflare.com')) throw new Error('fixture unavailable');
    throw new Error(`Unexpected network request: ${url}`);
  });
  const summary = await collectRouting(new AbortController().signal);
  assert.equal(summary.domestic.countryCode, 'CN');
  assert.equal(summary.overseas.countryCode, 'JP');
  assert.equal(summary.comparison, 'different');
  assert.equal(summary.sites.attempted, 8);
  assert.equal(summary.sites.observed, 7);
  assert.equal(summary.sites.unavailable, 1);
  assert.equal(summary.sites.unsupported, 1);
  assert.equal(summary.sites.domesticMatches, 4);
  assert.equal(summary.sites.overseasMatches, 2);
  assert.equal(summary.sites.otherMatches, 1);
  assert.equal(summary.sites.ipv4Exits, 3);
  assert.doesNotMatch(JSON.stringify(summary), /1\.1\.1\.1|8\.8\.8\.8|9\.9\.9\.9/);
});
