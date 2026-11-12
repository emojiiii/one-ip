import assert from "node:assert/strict";
import { test } from "node:test";
import { bundledModuleUrl } from "./compile.mjs";
const api = await import(bundledModuleUrl("migration/sveltekit/src/lib/ip/connectivity.ts"));

test("site probes use the website origin when an egress endpoint is unavailable", () => {
  assert.equal(
    api.siteProbeUrl({ domain: "www.amazon.com", url: "https://ignored.test" }),
    "https://www.amazon.com/",
  );
  assert.equal(
    api.siteProbeUrl({ url: "https://api.ip.sb/jsonip" }),
    "https://api.ip.sb/jsonip",
  );
});

test("site reachability is independent from egress-IP parsing", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return new Response(null, { status: 404 });
  };
  try {
    assert.equal(
      await api.probeSite({
        domain: "www.amazon.com",
        icon: "",
        name: "Amazon",
        method: "cftrace",
      }),
      true,
    );
    assert.deepEqual(calls, ["https://www.amazon.com/"]);
  } finally {
    globalThis.fetch = original;
  }
});

test("site reachability reports transport failure as inaccessible", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("offline");
  };
  try {
    assert.equal(
      await api.probeSite({
        domain: "www.example.com",
        icon: "",
        name: "Example",
        method: "cftrace",
      }),
      false,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("site inspection reuses a successful egress response as reachability", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return new Response("ip=1.1.1.1\nloc=SG\n", { status: 200 });
  };
  try {
    const result = await api.inspectSite({
      domain: "www.example.com",
      icon: "",
      name: "Example",
      method: "cftrace",
    });
    assert.equal(result.reachable, true);
    assert.equal(result.geo?.ip, "1.1.1.1");
    assert.deepEqual(calls, ["https://www.example.com/cdn-cgi/trace"]);
  } finally {
    globalThis.fetch = original;
  }
});

test("egress-only summaries skip requests that cannot contribute an IP", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return new Response(null, { status: 404 });
  };
  const site = { name: "Example", domain: "www.example.com", method: "cftrace" };
  try {
    assert.equal(await api.readSiteEgress(site), undefined);
    assert.equal(await api.readSiteEgress({ ...site, method: "unsupported" }), undefined);
    assert.deepEqual(calls, ["https://www.example.com/cdn-cgi/trace"]);

    calls.length = 0;
    assert.deepEqual(await api.inspectSite(site), { reachable: true });
    assert.deepEqual(calls, ["https://www.example.com/cdn-cgi/trace", "https://www.example.com/"]);
  } finally {
    globalThis.fetch = original;
  }
});
