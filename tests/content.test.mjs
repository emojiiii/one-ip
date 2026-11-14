import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { defaultLocale, localeDefinition, locales, localizedPath, publicPages } from '../migration/sveltekit/src/lib/i18n.ts';

const root = 'migration/sveltekit';
const output = 'dist';
const expectedCanonicalPath = (path, locale) => path === '/' && locale === defaultLocale ? '/' : localizedPath(path, locale);

test('public tool pages have prerendered HTML and IP paths have a fallback', () => {
  assert.equal(locales.length, 10);
  const home = readFileSync(`${output}/index.html`, 'utf8');
  const homeCanonical = home.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert.ok(homeCanonical);
  const origin = process.env.VITE_SITE_ORIGIN?.trim() || new URL(homeCanonical).origin;

  for (const page of publicPages) {
    const variants = [
      { path: page, ...localeDefinition(defaultLocale) },
      ...locales.map(({ id, dir }) => ({ path: localizedPath(page, id), id, dir })),
    ];
    const alternates = Object.fromEntries([
      ...locales.map(({ id, hreflang }) => [hreflang, new URL(expectedCanonicalPath(page, id), origin).href]),
      ['x-default', new URL(page, origin).href],
    ]);
    const results = variants.map(({ path, id, dir }) => {
      const html = readFileSync(`${output}/${path === '/' ? 'index' : path.slice(1)}.html`, 'utf8');
      assert.ok(html.includes(`<html lang="${id}" dir="${dir}">`), path);
      const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1];
      assert.ok(head, path);
      const title = head.match(/<title>([^<]+)<\/title>/)?.[1];
      assert.ok(title, path);
      const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1];
      const heading = main?.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, '').trim();
      assert.ok(heading, path);
      const descriptions = [...head.matchAll(/<meta name="description" content="([^"]+)"/g)];
      assert.equal(descriptions.length, 1, path);
      const canonical = head.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      assert.equal(canonical, new URL(expectedCanonicalPath(page, id), origin).href, path);
      const socialTitle = head.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
      assert.ok(socialTitle?.endsWith(' · One IP'), path);
      if (page === '/') assert.equal(socialTitle, title, path);
      assert.equal(head.match(/<meta name="twitter:title" content="([^"]+)"/)?.[1], socialTitle, path);
      assert.equal(head.match(/<meta property="og:url" content="([^"]+)"/)?.[1], canonical, path);
      assert.equal(head.match(/<meta property="og:description" content="([^"]+)"/)?.[1], descriptions[0][1], path);
      const json = head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
      assert.ok(json, path);
      const data = JSON.parse(json);
      assert.equal(data.url, canonical, path);
      assert.equal(data.inLanguage, id, path);
      assert.equal(data.description.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'), descriptions[0][1], path);
      const links = [...head.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)];
      assert.equal(links.length, locales.length + 1, path);
      assert.deepEqual(Object.fromEntries(links.map(([, language, href]) => [language, href])), alternates, path);
      return { title, heading, description: descriptions[0][1] };
    });
    const [unprefixed, ...prefixed] = results;
    for (const [index, localized] of prefixed.entries()) {
      const { path, id } = variants[index + 1];
      if (id === defaultLocale) {
        assert.deepEqual(localized, unprefixed, path);
        continue;
      }
      assert.notEqual(localized.title, unprefixed.title, path);
      assert.notEqual(localized.description, unprefixed.description, path);
      assert.notEqual(localized.heading, unprefixed.heading, path);
    }
  }
  assert.ok(existsSync(`${output}/200.html`));
});

test('localized status pages render their main content before JavaScript', () => {
  assert.match(readFileSync(`${output}/status.html`, 'utf8'), /<h1[^>]*>服务状态<\/h1>/);
  assert.match(readFileSync(`${output}/en/status.html`, 'utf8'), /<h1[^>]*>Service status<\/h1>/);
  assert.match(readFileSync(`${output}/zh/status.html`, 'utf8'), /<h1[^>]*>服务状态<\/h1>/);
});

test('home explains its results and links data sources before JavaScript', () => {
  for (const { id } of locales) {
    const html = readFileSync(`${output}${localizedPath('/', id)}.html`, 'utf8');
    const guide = html.match(/<section class="ui-panel guide\b[\s\S]*?<p class="sources\b[\s\S]*?<\/p>\s*<\/section>/)?.[0];
    assert.ok(guide, id);
    assert.equal([...guide.matchAll(/<h3\b/g)].length, 3, id);
    for (const source of ['https://ipquery.io/', 'https://ipwho.is/', 'https://ip.net.coffee/', 'https://developers.cloudflare.com/network/ip-geolocation/#accuracy-and-limitations'])
      assert.ok(guide.includes(`href="${source}"`), `${id}: ${source}`);
  }
});

test('DNS records do not shadow the legacy DNS leak shortcut', () => {
  assert.ok(publicPages.includes('/dns-records'));
  assert.ok(!publicPages.includes('/dns'));
  assert.equal(existsSync(`${output}/dns.html`), false);
  for (const { id } of locales)
    assert.equal(existsSync(`${output}${localizedPath('/dns', id)}.html`), false, id);
});

test('crawler files list each localized canonical once', () => {
  const robots = readFileSync(`${output}/robots.txt`, 'utf8');
  assert.match(robots, /^User-agent: \*\nDisallow: \/api\/\n/);
  const home = readFileSync(`${output}/index.html`, 'utf8');
  const canonical = home.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert.ok(canonical);
  assert.ok(robots.includes(`Sitemap: ${new URL('/sitemap.xml', canonical).href}\n`));
  const llms = readFileSync(`${output}/llms.txt`, 'utf8');
  assert.match(llms, /^# One IP\n/);
  for (const path of ['/', '/ip', '/dns-records', '/leak/dns', '/leak/webrtc', '/unlock/sites', '/ping', '/status', '/about', '/privacy', '/terms']) {
    assert.ok(llms.includes(new URL(expectedCanonicalPath(path, defaultLocale), canonical).href), path);
  }
  const xml = readFileSync(`${output}/sitemap.xml`, 'utf8');
  const expected = new Map();
  for (const page of publicPages) {
    for (const { id } of locales) {
      const html = readFileSync(`${output}${localizedPath(page, id)}.html`, 'utf8');
      const loc = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)]
        .map(([, language, href]) => [language, href]);
      expected.set(loc, alternates);
    }
  }

  assert.equal(expected.size, publicPages.length * locales.length);
  for (const [, entry] of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = entry.match(/<loc>([^<]+)<\/loc>/)?.[1];
    assert.ok(expected.has(loc), `Unexpected or duplicate sitemap URL: ${loc}`);
    const alternates = [...entry.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g)]
      .map(([, language, href]) => [language, href]);
    assert.deepEqual(alternates, expected.get(loc), loc);
    expected.delete(loc);
  }
  assert.equal(expected.size, 0, `Missing sitemap URLs: ${[...expected.keys()].join(', ')}`);
});

test('production assets exclude backend and retired pages', () => {
  for (const path of ['worker', 'favicons', 'claude', 'news', 'browser/challenges.html'])
    assert.equal(existsSync(`${output}/${path}`), false, path);
});

test('connectivity catalog icons use HTTPS', () => {
  const targets = JSON.parse(readFileSync(`${root}/src/routes/unlock/sites/targets.json`, 'utf8'));
  assert.ok(targets.length > 0);
  for (const { icon } of targets) assert.equal(new URL(icon).protocol, 'https:');
});
