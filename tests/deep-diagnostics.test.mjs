import { adaptNavigator } from "../scripts/browser-diagnostics-adapter.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { bundledModuleUrl } from "./compile.mjs";

const sha = (content) => createHash("sha256").update(content).digest("hex");
test("vendored detection modules match the pinned upstream revision", () => {
  const manifest = JSON.parse(
    readFileSync("vendor/browser-diagnostics/upstream.json", "utf8"),
  );
  assert.match(manifest.commit, /^[a-f0-9]{40}$/);
  for (const [file, hash] of Object.entries(manifest.files))
    assert.equal(
      sha(readFileSync(`vendor/browser-diagnostics/upstream/${file}`)),
      hash,
      file,
    );
  assert.equal(
    readFileSync("vendor/browser-diagnostics/LICENSE", "utf8"),
    readFileSync("migration/sveltekit/static/browser-diagnostics.LICENSE.txt", "utf8"),
  );
});
test("runtime cache version matches the shipped local bundle and excludes remote app calls", () => {
  const version = JSON.parse(
    readFileSync("migration/sveltekit/src/lib/browser/diagnostics-version.json", "utf8"),
  );
  const bundle = readFileSync("migration/sveltekit/static/browser-diagnostics.js", "utf8");
  assert.equal(sha(bundle), version.bundleHash);
  assert.doesNotMatch(
    bundle,
    /\bfetch\s*\(|new XMLHttpRequest|\.sendBeacon\s*\(/,
  );
  assert.match(bundle, /local-browser-diagnostics/);
});

test("navigator adapter skips absent Worker comparisons but preserves mismatch detection", () => {
  const source = adaptNavigator(readFileSync("vendor/browser-diagnostics/upstream/navigator/index.ts", "utf8"));
  for (const field of ["platform", "userAgent", "deviceMemory", "hardwareConcurrency", "language", "languages"]) {
    const expression = source.match(new RegExp(`if \\((workerScope && ${field} !==? workerScope\\.${field})\\)`))?.[1];
    assert.ok(expression, field);
    const compare = new Function("workerScope", field, `return Boolean(${expression})`);
    assert.equal(compare(undefined, "local"), false);
    assert.equal(compare({ [field]: "local" }, "local"), false);
    assert.equal(compare({ [field]: "other" }, "local"), true);
  }
});

test("deep diagnostics aborts cleanly without accepting another frame's messages", async () => {
  const { collectDeepDiagnostics } = await import(bundledModuleUrl("migration/sveltekit/src/lib/browser/deep-diagnostics.ts"));
  const prior = Object.fromEntries(['window', 'document', 'location', 'innerWidth', 'innerHeight'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const listeners = new Map();
  const frame = { style: {}, contentWindow: {}, setAttribute() {}, remove() { this.removed = true; } };
  const location = new URL('https://example.test/');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location, addEventListener(type, handler) { listeners.set(type, handler); }, removeEventListener(type) { listeners.delete(type); } } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => frame, body: { append() {} } } });
  Object.defineProperty(globalThis, 'location', { configurable: true, value: location });
  Object.defineProperty(globalThis, 'innerWidth', { configurable: true, value: 800 });
  Object.defineProperty(globalThis, 'innerHeight', { configurable: true, value: 600 });
  try {
    const controller = new AbortController();
    const pending = collectDeepDiagnostics(controller.signal);
    assert.match(frame.srcdoc, /connect-src data:/);
    listeners.get('message')({ source: {}, origin: 'https://example.test', data: { type: 'local-browser-diagnostics', result: { modules: {}, duration: 1 } } });
    assert.equal(frame.removed, undefined);
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(frame.removed, true);
    assert.equal(listeners.has('message'), false);
  } finally {
    for (const [key, descriptor] of Object.entries(prior)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});
