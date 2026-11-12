import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "../.worker-test/index.js";

const origin = "https://example.com";
const request = (path) => worker.fetch(new Request(origin + path), {});

test("status summary limits concurrency, isolates failures, and shares detail cache", async (t) => {
  const cache = new Map();
  const original = Object.getOwnPropertyDescriptor(globalThis, "caches");
  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: {
      default: {
        async match(key) {
          return cache.get(key.url)?.clone();
        },
        async put(key, response) {
          cache.set(key.url, response);
        },
      },
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "caches", original);
    else delete globalThis.caches;
  });

  const hosts = [];
  let active = 0;
  let peak = 0;
  t.mock.method(globalThis, "fetch", async (input) => {
    const host = new URL(input).hostname;
    hosts.push(host);
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    if (host === "status.sendgrid.com")
      return new Response(null, { status: 502 });
    if (host === "status.cursor.com") return Response.json({});
    return Response.json({
      status: { indicator: "major", description: "Partial System Outage" },
      components: [{ id: "api", name: "API", status: "major_outage" }],
      incidents: [],
    });
  });

  const response = await request("/api/status/summary?ids=0,1,2,3,4,5,6,8,0");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const { services } = await response.json();
  assert.equal(Object.keys(services).length, 8);
  assert.equal(services["2"], null);
  assert.equal(services["5"], null);
  assert.deepEqual(services["0"], {
    status: { indicator: "major", description: "Partial System Outage" },
    fetchedAt: services["0"].fetchedAt,
  });
  assert.ok(Number.isFinite(Date.parse(services["0"].fetchedAt)));
  assert.equal(peak, 4);
  assert.equal(hosts.length, 8);

  const detail = await (await request("/api/status/0")).json();
  assert.equal(detail.fetchedAt, services["0"].fetchedAt);
  assert.equal(detail.components[0].status, "major_outage");
  assert.equal(hosts.length, 8);
  assert.equal(
    cache.get(`${origin}/api/status/0`).headers.get("Cache-Control"),
    "public, max-age=60",
  );
});

test("status summary rejects invalid or oversized service lists before fetching", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => new Response());
  for (const query of [
    "",
    "?ids=",
    "?ids=0,missing",
    "?ids=" + Array(13).fill("0").join(","),
  ]) {
    assert.equal((await request(`/api/status/summary${query}`)).status, 400);
  }
  assert.equal(fetch.mock.callCount(), 0);
});
