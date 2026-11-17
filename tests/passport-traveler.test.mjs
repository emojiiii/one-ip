import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildSync } from 'esbuild';

const bundle = buildSync({
  stdin: {
    contents: "export { travelerProfile } from './migration/sveltekit/src/lib/passport/traveler.ts'; export { registerLocale } from './migration/sveltekit/src/lib/message-catalog.ts';",
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  define: { 'import.meta.env.SSR': 'false' },
  write: false,
});
const { travelerProfile, registerLocale } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
for (const locale of ['zh-CN', 'en', 'es-419', 'pt-BR', 'fr', 'de', 'ja', 'ko', 'ar', 'hi']) {
  const passport = JSON.parse(readFileSync(`migration/sveltekit/src/i18n/${locale}/passport.json`, 'utf8'));
  registerLocale(locale, { passport });
}

test('compares the exit country against the configured time zone and includes the browser language', async () => {
  const input = { countryCode: 'cn', timeZone: 'Asia/Shanghai', language: 'zh-CN', locale: 'zh-CN' };
  const aligned = await travelerProfile(input);
  assert.equal(aligned.kind, 'aligned');
  assert.match(aligned.description, /中文/);
  assert.match(aligned.basis, /zh-CN/);
  assert.match(aligned.basis, /Asia\/Shanghai/);
  assert.match(aligned.basis, /出口 CN/);

  const cross = await travelerProfile({ ...input, countryCode: 'JP' });
  assert.equal(cross.kind, 'cross-region');
  assert.match(cross.description, /不同/);
  assert.match(cross.description, /中文/);
});

test('shared zones and time zone aliases use all associated countries', async () => {
  const shared = { timeZone: 'Africa/Abidjan', language: 'en', locale: 'en' };
  assert.equal((await travelerProfile({ ...shared, countryCode: 'CI' })).kind, 'aligned');
  assert.equal((await travelerProfile({ ...shared, countryCode: 'GH' })).kind, 'aligned');
  assert.equal((await travelerProfile({ ...shared, countryCode: 'JP' })).kind, 'cross-region');
  assert.equal((await travelerProfile({ ...shared, countryCode: 'CN', timeZone: 'Asia/Chongqing' })).kind, 'aligned');
});

test('unknown zones, missing or invalid countries, and zones without countries remain unknown', async () => {
  const input = { countryCode: 'JP', timeZone: 'Asia/Tokyo', locale: 'en' };
  for (const changes of [
    { timeZone: 'Etc/UTC' },
    { timeZone: 'Unknown/Zone' },
    { timeZone: undefined },
    { countryCode: undefined },
    { countryCode: 'ZZ' },
  ]) {
    const result = await travelerProfile({ ...input, ...changes });
    assert.equal(result.kind, 'unknown');
    assert.match(result.description, /Unknown/);
  }
});

test('a language without a region stays a language preference', async () => {
  const result = await travelerProfile({ countryCode: 'JP', timeZone: 'Asia/Tokyo', language: 'en', locale: 'en' });
  assert.equal(result.kind, 'aligned');
  assert.match(result.description, /browser language: English\./);
  assert.match(result.basis, /Language en$/);
});

test('adds independently explained reputation, network and language badges', async () => {
  const result = await travelerProfile({
    countryCode: 'JP', timeZone: 'Asia/Shanghai', language: 'zh-CN', locale: 'zh-CN',
    reputationScore: 85, reputationSource: 'Net.Coffee', exitType: 'datacenter',
  });
  assert.equal(result.kind, 'cross-region');
  assert.equal(result.title, '住在机房的云朵');
  assert.deepEqual(result.badges.map(({ id }) => id), ['timezone', 'network', 'reputation', 'language']);
  assert.match(result.badges.find(({ id }) => id === 'reputation').detail, /85\/100.*Net\.Coffee/);
  assert.match(result.badges.find(({ id }) => id === 'network').detail, /机房/);
  assert.match(result.badges.find(({ id }) => id === 'timezone').detail, /Asia\/Shanghai.*JP/);
});

test('does not invent badges for missing or invalid source data', async () => {
  const input = { countryCode: 'JP', timeZone: 'Etc/UTC', locale: 'en' };
  for (const reputationScore of [undefined, -1, 101, NaN, Infinity]) {
    const result = await travelerProfile({ ...input, reputationScore });
    assert.equal(result.kind, 'unknown');
    assert.deepEqual(result.badges, []);
  }
  for (const reputationScore of [0, 100]) {
    const result = await travelerProfile({ ...input, reputationScore });
    assert.match(result.badges.find(({ id }) => id === 'reputation').label, new RegExp(`${reputationScore}/100`));
  }
});

test('keeps conflicting classifications and public services distinct', async () => {
  const input = { countryCode: 'US', timeZone: 'America/New_York', locale: 'en' };
  const conflict = await travelerProfile({ ...input, exitType: 'conflict' });
  assert.match(conflict.badges.find(({ id }) => id === 'network').detail, /both residential and data center/);
  const publicService = await travelerProfile({ ...input, exitType: 'public-service' });
  assert.equal(publicService.badges.find(({ id }) => id === 'network').label, 'Public service');
});

test('reputation labels follow the existing IP score bands without dropping the score', async () => {
  const input = { countryCode: 'CN', timeZone: 'Asia/Shanghai', locale: 'zh-CN', reputationSource: 'Net.Coffee' };
  for (const [reputationScore, label] of [[90, '信誉优选'], [89, '信誉良好'], [75, '信誉良好'], [74, '信誉观察'], [45, '信誉观察'], [44, '信誉待留意']]) {
    const result = await travelerProfile({ ...input, reputationScore });
    const badge = result.badges.find(({ id }) => id === 'reputation');
    assert.equal(badge.label, `${label} · ${reputationScore}/100`);
    assert.match(badge.detail, /Net\.Coffee/);
  }
});

function routing(comparison, sites) {
  return {
    domestic: { status: comparison === 'unknown' ? 'unavailable' : 'observed' },
    overseas: { status: 'observed' },
    comparison,
    sites: {
      total: 4, attempted: 0, observed: 0, unavailable: 0, unsupported: 0, notAttempted: 4,
      ipv4Observed: 0, ipv6Observed: 0, ipv4Exits: 0, ipv6Exits: 0,
      domesticMatches: 0, overseasMatches: 0, bothMatches: 0, otherMatches: 0, unclassified: 0, details: [],
      ...sites,
    },
  };
}

test('titles and badges reflect separate domestic, overseas and observed site exits', async () => {
  const input = { countryCode: 'JP', timeZone: 'Asia/Shanghai', language: 'zh-CN', locale: 'zh-CN', exitType: 'datacenter', reputationScore: 85 };
  const multi = await travelerProfile({ ...input, routing: routing('different', {
    attempted: 3, observed: 2, unavailable: 1, notAttempted: 1, ipv4Observed: 2, ipv4Exits: 2,
  }) });
  assert.equal(multi.title, '我的网络会分身');
  assert.equal(multi.badges.find(({ id }) => id === 'exits').label, '双出口足迹');
  assert.match(multi.badges.find(({ id }) => id === 'routing').detail, /读取 2\/4 站点；IPv4 2 组，IPv6 0 组/);
  assert.ok(multi.badges.some(({ id }) => id === 'reputation'));
  assert.ok(multi.badges.some(({ id }) => id === 'network'));

  const dual = await travelerProfile({ ...input, routing: routing('different', {}) });
  assert.equal(dual.title, '网络出门带两把钥匙');
  const same = await travelerProfile({ ...input, routing: routing('same', {}) });
  assert.equal(same.title, '大家都挤同一扇门');
  assert.match(same.badges.find(({ id }) => id === 'exits').detail, /相同地址/);
});

test('combines matched domestic and overseas routes with reputation without guessing missing scores', async () => {
  const input = { locale: 'zh-CN', routing: routing('different', {
    attempted: 4, observed: 4, notAttempted: 0, ipv4Observed: 4, ipv4Exits: 2,
    domesticMatches: 1, overseasMatches: 3,
  }) };
  const titles = new Set();
  for (const reputationScore of [90, 75, 45, 44]) {
    const result = await travelerProfile({ ...input, reputationScore });
    titles.add(result.title);
    assert.match(result.description, new RegExp(`${reputationScore}`));
    assert.match(result.description, /1/);
    assert.match(result.description, /3/);
  }
  assert.equal(titles.size, 4);
  for (const reputationScore of [undefined, -1, 101, NaN]) {
    const result = await travelerProfile({ ...input, reputationScore });
    assert.equal(result.title, '网络分身术入门');
  }
  const oneSided = await travelerProfile({ ...input, reputationScore: 75, routing: routing('different', {
    attempted: 3, observed: 3, notAttempted: 1, ipv4Observed: 3, ipv4Exits: 2,
    domesticMatches: 3, overseasMatches: 0,
  }) });
  assert.equal(oneSided.title, '我的网络会分身');
});

test('all route and score combinations produce distinct titles with the observed score', async () => {
  const paths = [
    routing('different', { attempted: 2, observed: 2, notAttempted: 2, ipv4Observed: 2, ipv4Exits: 2, domesticMatches: 1, overseasMatches: 1 }),
    routing('unknown', { attempted: 2, observed: 2, notAttempted: 2, ipv4Observed: 2, ipv4Exits: 2 }),
    routing('different', {}),
    routing('same', {}),
  ];
  const titles = new Set();
  for (const path of paths) {
    for (const score of [90, 75, 45, 44]) {
      const result = await travelerProfile({ locale: 'zh-CN', routing: path, reputationScore: score });
      titles.add(result.title);
      assert.match(result.description, new RegExp(`${score}`));
      assert.doesNotMatch(result.description, /\{\w+\}/);
    }
  }
  assert.equal(titles.size, 16);
});

test('every supported locale renders all combination titles and descriptions', async () => {
  const paths = [
    routing('different', { attempted: 2, observed: 2, notAttempted: 2, ipv4Observed: 2, ipv4Exits: 2, domesticMatches: 1, overseasMatches: 1 }),
    routing('unknown', { attempted: 2, observed: 2, notAttempted: 2, ipv4Observed: 2, ipv4Exits: 2 }),
    routing('different', {}),
    routing('same', {}),
  ];
  for (const locale of ['zh-CN', 'en', 'es-419', 'pt-BR', 'fr', 'de', 'ja', 'ko', 'ar', 'hi']) {
    for (const path of paths) {
      for (const score of [90, 75, 45, 44]) {
        const result = await travelerProfile({ locale, routing: path, reputationScore: score });
        assert.ok(result.title, locale);
        assert.match(result.description, new RegExp(`${score}`), locale);
        assert.doesNotMatch(result.description, /\{\w+\}/, locale);
      }
    }
  }
});

test('only comparable observations within the same address family yield a site-route title', async () => {
  const input = { countryCode: 'JP', timeZone: 'Asia/Shanghai', locale: 'zh-CN', exitType: 'datacenter' };
  const shared = await travelerProfile({ ...input, routing: routing('unknown', {
    attempted: 2, observed: 2, notAttempted: 2, ipv4Observed: 2, ipv4Exits: 1,
  }) });
  assert.equal(shared.title, '大家走同一扇门');

  for (const sites of [
    { attempted: 1, observed: 1, notAttempted: 3, ipv4Observed: 1, ipv4Exits: 1 },
    { attempted: 2, observed: 2, notAttempted: 2, ipv4Observed: 1, ipv6Observed: 1, ipv4Exits: 1, ipv6Exits: 1 },
    { attempted: 4, unavailable: 4, notAttempted: 0 },
  ]) {
    const result = await travelerProfile({ ...input, routing: routing('unknown', sites) });
    assert.equal(result.title, '住在机房的云朵');
    assert.notEqual(result.badges.find(({ id }) => id === 'routing').label, '多路足迹');
  }
  const empty = await travelerProfile({ ...input, routing: routing('unknown', { attempted: 4, unavailable: 4, notAttempted: 0 }) });
  assert.equal(empty.badges.find(({ id }) => id === 'routing').label, '站点出口待确认');
  assert.match(empty.badges.find(({ id }) => id === 'routing').detail, /读取 0\/4 站点/);
});

test('routing badges exclude unavailable probes from conclusions and raw addresses from sharing', async () => {
  const result = await travelerProfile({ countryCode: 'US', timeZone: 'America/New_York', locale: 'en', routing: routing('unknown', {
    attempted: 1, observed: 1, notAttempted: 2, unsupported: 1, ipv6Observed: 1, ipv6Exits: 1,
  }) });
  const exits = result.badges.find(({ id }) => id === 'exits');
  const sites = result.badges.find(({ id }) => id === 'routing');
  assert.equal(exits.label, 'Exit comparison unavailable');
  assert.match(sites.detail, /1\/3 sites readable/);
  assert.doesNotMatch(JSON.stringify(result), /(?:\d{1,3}\.){3}\d{1,3}/);
});
