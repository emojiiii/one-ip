import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { bundledModuleUrl } from './compile.mjs';
import { localeFromPath, locales } from '../migration/sveltekit/src/lib/i18n.ts';

const root = 'migration/sveltekit/src';
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const resources = `${root}/i18n`;

test('translated catalogs contain matching keys and placeholders', () => {
  assert.equal(locales.length, 10);
  const catalogs = readdirSync(`${resources}/en`).filter(file => file.endsWith('.json')).sort();
  for (const { id } of locales)
    assert.deepEqual(readdirSync(`${resources}/${id}`).filter(file => file.endsWith('.json')).sort(), catalogs, id);
  for (const file of catalogs) {
    const en = json(`${resources}/en/${file}`);
    for (const { id } of locales.filter(({ id }) => id !== 'en')) {
      const translated = json(`${resources}/${id}/${file}`);
      assert.deepEqual(Object.keys(translated).sort(), Object.keys(en).sort(), `${id}/${file}`);
      for (const key of Object.keys(en)) {
        const value = translated[key];
        assert.equal(typeof value, 'string', `${id}/${file}: ${key}`);
        assert.ok(value.trim() || !en[key].trim(), `${id}/${file}: ${key}`);
        assert.deepEqual(value.match(/\{\d+\}/g)?.sort() ?? [], en[key].match(/\{\d+\}/g)?.sort() ?? [], `${id}/${file}: ${key}`);
      }
    }
  }
});

test('literal browser and network translation calls exist in their catalogs', () => {
  for (const [dir, catalog] of Object.entries({
    'lib/browser': 'browser',
    'routes/leak/dns': 'dns',
    'routes/leak/webrtc': 'webrtc',
    'routes/ping': 'ping',
    'routes/speedtest': 'network',
  })) {
    const zh = json(`${resources}/zh-CN/${catalog}.json`);
    for (const file of readdirSync(`${root}/${dir}`)) {
      if (!/\.(?:ts|svelte)$/.test(file)) continue;
      const source = readFileSync(`${root}/${dir}/${file}`, 'utf8');
      for (const match of source.matchAll(/\b(?:t|translate)\(\s*(['"])([^'"\r\n]+)\1\s*[,)]/g))
        assert.ok(Object.hasOwn(zh, match[2]), `${dir}/${file}: ${match[2]}`);
    }
  }
});

test('translations accept the page locale during prerendering and follow the URL in browser code', async () => {
  assert.equal(localeFromPath('/'), 'zh-CN');
  assert.equal(localeFromPath('/en'), 'en');
  const runtime = await import(bundledModuleUrl(`${root}/routes/leak/webrtc/locale.ts`));
  assert.equal(runtime.t('api.requestFailed', [503], 'en'), 'Request failed (503)');
  assert.equal(runtime.t('api.requestFailed', ['{1} <script>'], 'zh-CN'), '请求失败 ({1} <script>)');
  assert.equal(runtime.t('api.requestFailed', [], 'en'), 'Request failed ({0})');
  assert.equal(runtime.t('api.requestFailed', ['$t(api.requestFailed)'], 'en'), 'Request failed ($t(api.requestFailed))');
  assert.equal(runtime.t('api.requestFailed', [503], 'en'), 'Request failed (503)');

  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const location = { pathname: '/en/leak/webrtc' };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location } });
  try {
    assert.equal(runtime.t('api.requestFailed', [503]), 'Request failed (503)');
    assert.equal(await runtime.localizeApiMessage('外部数据源连接失败或超时'), 'Upstream connection failed or timed out');
    assert.equal(await runtime.localizeApiMessage('外部数据源暂不可用 (502)'), '外部数据源暂不可用 (502)');
    location.pathname = '/zh/leak/webrtc';
    assert.equal(runtime.t('api.requestFailed', [503]), '请求失败 (503)');
    location.pathname = '/leak/webrtc';
    assert.equal(runtime.t('api.requestFailed', [503]), '请求失败 (503)');
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original); else delete globalThis.window;
  }
});
