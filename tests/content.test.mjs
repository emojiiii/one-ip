import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { locales, localizedPath, publicPages } from '../migration/sveltekit/src/lib/i18n.ts';

const root = 'migration/sveltekit';
const output = 'dist';

test('public tool pages have prerendered HTML and IP paths have a fallback', () => {
  assert.equal(locales.length, 10);
  const home = readFileSync(`${output}/index.html`, 'utf8');
  const homeCanonical = home.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert.ok(homeCanonical);
  const origin = process.env.VITE_SITE_ORIGIN?.trim() || new URL(homeCanonical).origin;

  for (const page of publicPages) {
    const variants = [
      { path: page, id: 'en', dir: 'ltr' },
      ...locales.map(({ id, dir }) => ({ path: localizedPath(page, id), id, dir })),
    ];
    const alternates = Object.fromEntries([
      ...locales.map(({ id, hreflang }) => [hreflang, new URL(localizedPath(page, id), origin).href]),
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
      assert.equal(canonical, new URL(localizedPath(page, id), origin).href, path);
      const links = [...head.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)];
      assert.equal(links.length, locales.length + 1, path);
      assert.deepEqual(Object.fromEntries(links.map(([, language, href]) => [language, href])), alternates, path);
      return { title, heading, description: descriptions[0][1] };
    });
    assert.deepEqual(results[0], results[1], page);
    for (const [index, localized] of results.slice(2).entries()) {
      const path = variants[index + 2].path;
      assert.notEqual(localized.title, results[0].title, path);
      assert.notEqual(localized.description, results[0].description, path);
      assert.notEqual(localized.heading, results[0].heading, path);
    }
  }
  assert.ok(existsSync(`${output}/200.html`));
});

test('localized status pages render their main content before JavaScript', () => {
  assert.match(readFileSync(`${output}/status.html`, 'utf8'), /<h1[^>]*>Service status<\/h1>/);
  assert.match(readFileSync(`${output}/zh/status.html`, 'utf8'), /<h1[^>]*>服务状态<\/h1>/);
});

test('crawler files list each localized canonical once', () => {
  const robots = readFileSync(`${output}/robots.txt`, 'utf8');
  assert.match(robots, /^User-agent: \*\nDisallow: \/api\/\n/);
  const home = readFileSync(`${output}/index.html`, 'utf8');
  const canonical = home.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert.ok(canonical);
  assert.ok(robots.includes(`Sitemap: ${new URL('/sitemap.xml', canonical).href}\n`));
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

  assert.equal(expected.size, 170);
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
