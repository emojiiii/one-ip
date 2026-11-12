import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bundledModuleUrl } from './compile.mjs';

const { homeExitCards } = await import(bundledModuleUrl('migration/sveltekit/src/lib/ip/home.ts'));
const labels = { domestic: '国内出口', overseas: '海外出口' };
const domestic = { ip: '192.0.2.1' };
const overseas = { ip: '192.0.2.2' };

test('domestic and overseas results stay independent and in order', () => {
  const cards = homeExitCards(domestic, overseas, false, false, labels);
  assert.deepEqual(cards.map(card => card.geo), [domestic, overseas]);
  assert.deepEqual(cards.map(card => card.label), ['国内出口', '海外出口 IPv4']);
  assert.equal(homeExitCards(domestic, domestic, false, false, labels).length, 2);
});
test('failed probes do not promote the other address into the missing card', () => {
  assert.deepEqual(homeExitCards(undefined, overseas, false, false, labels).map(card => card.geo), [overseas]);
  assert.deepEqual(homeExitCards(domestic, null, false, false, labels).map(card => card.geo), [domestic]);
  assert.deepEqual(homeExitCards(undefined, null, false, false, labels), []);
});
test('pending probes retain placeholders rather than showing stale results', () => {
  const cards = homeExitCards(undefined, null, true, true, labels);
  assert.equal(cards.length, 2);
  assert.ok(cards.every(card => card.busy && !card.geo));
});
