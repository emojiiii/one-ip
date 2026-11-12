import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryCache } from "../server/memory-cache.mjs";
import { bundledModuleUrl } from "./compile.mjs";

const { default: worker } = await import(bundledModuleUrl("worker/index.js"));

test("fresh IP lookups bypass the shared cache without changing ordinary lookups", async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  let lookups = 0;
  globalThis.caches = { default: memoryCache() };
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.startsWith("https://ipwho.is/"))
      return Response.json({ success: true, ip: "1.1.1.1", country: `version-${++lookups}`, connection: { asn: 13335 } });
    if (target.startsWith("https://api.ip.sb/"))
      return Response.json({ ip: "1.1.1.1", country: "secondary" });
    if (target.startsWith("https://rdap.org/"))
      return Response.json({ handle: "NET-1" });
    throw new Error(`Unexpected upstream: ${target}`);
  };
  const env = { API_LIMITER: { limit: async () => ({ success: true }) } };
  const request = (suffix = "") => new Request(`https://example.com/api/ip/lookup/1.1.1.1${suffix}`);
  try {
    let response = await worker.fetch(request(), env);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal((await response.json()).geo.country, "version-1");
    assert.equal((await (await worker.fetch(request(), env)).json()).geo.country, "version-1");
    response = await worker.fetch(request("?fresh=1"), env);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal((await response.json()).geo.country, "version-2");
    assert.equal((await (await worker.fetch(request(), env)).json()).geo.country, "version-1");
    assert.equal((await (await worker.fetch(request("?fresh=1"), env)).json()).geo.country, "version-3");
    assert.equal(lookups, 3);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
  }
});
