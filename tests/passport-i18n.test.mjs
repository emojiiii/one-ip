import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildSync } from 'esbuild';

const localeIds = ['zh-CN', 'en', 'es-419', 'pt-BR', 'fr', 'de', 'ja', 'ko', 'ar', 'hi'];
const catalogs = Object.fromEntries(localeIds.map(locale => [locale, JSON.parse(readFileSync(`migration/sveltekit/src/i18n/${locale}/passport.json`, 'utf8'))]));
const bundle = buildSync({
  stdin: { contents: "export { getPassportText, passportFormat } from './migration/sveltekit/src/lib/passport/locales.ts'; export { registerLocale } from './migration/sveltekit/src/lib/message-catalog.ts';", resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', target: 'node24', write: false,
});
const { getPassportText, passportFormat, registerLocale } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
const slots = value => [...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map(match => match[1]).sort();

test('all passport catalogs contain the same nonempty keys and interpolation placeholders', () => {
  const source = catalogs.en;
  for (const [locale, catalog] of Object.entries(catalogs)) {
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(source).sort(), locale);
    for (const [key, value] of Object.entries(catalog)) {
      assert.ok(typeof value === 'string' && value.trim(), `${locale}: ${key}`);
      assert.deepEqual(slots(value), slots(source[key]), `${locale}: ${key}`);
    }
  }
});

test('each locale resolves UI and traveler text, including all title combinations', () => {
  for (const [locale, catalog] of Object.entries(catalogs)) {
    registerLocale(locale, { passport: catalog });
    const text = getPassportText(locale);
    assert.equal(Object.keys(text.traveler.comboTitles).length, 16, locale);
    assert.equal(Object.keys(text.traveler.comboDescriptions).length, 4, locale);
    function verify(value) {
      if (typeof value === 'object') return Object.values(value).forEach(verify);
      assert.ok(typeof value === 'string' && value.trim(), locale);
      const values = Object.fromEntries(slots(value).map(slot => [slot, 17]));
      const result = passportFormat(value, values);
      assert.doesNotMatch(result, /\{[a-zA-Z][a-zA-Z0-9]*\}|undefined/, locale);
    }
    verify(text);
  }
});
