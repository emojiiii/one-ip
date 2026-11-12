import assert from "node:assert/strict";
import { test } from "node:test";
import { bundledModuleUrl } from "./compile.mjs";

const { dnsTypes, normalizeDomain, queryDns } = await import(
  bundledModuleUrl("migration/sveltekit/src/lib/dns-records.ts")
);

test("DNS domain input normalizes names and rejects URLs and malformed labels", () => {
  assert.equal(normalizeDomain("  Example.COM. "), "example.com");
  assert.equal(normalizeDomain("例子.测试"), "xn--fsqu00a.xn--0zwm56d");
  assert.equal(normalizeDomain("_dmarc.Example.com"), "_dmarc.example.com");
  for (const input of [
    "",
    "https://example.com",
    "example.com/path",
    "example.com:443",
    "a..example.com",
    "-bad.example.com",
    "bad-.example.com",
    "a b.example.com",
    "1.1.1.1",
    "0x01010101",
    "[::1]",
  ]) {
    assert.equal(normalizeDomain(input), null, input);
  }
});

test("both resolvers receive each requested record type and return TTL without mixing records", async () => {
  const oldFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    return Response.json({
      Status: 0,
      Answer: [
        { name: "example.com.", type: 5, TTL: 123, data: "alias.example.net." },
        { name: "alias.example.net.", type: 1, TTL: 61, data: "192.0.2.7" },
      ],
    });
  };
  try {
    const start = Date.now();
    for (const provider of ["cloudflare", "google"]) {
      for (const type of dnsTypes) {
        const result = await queryDns(
          "example.com",
          provider,
          type,
          new AbortController().signal,
        );
        assert.equal(result.status, 0);
        assert.deepEqual(result.answers, [
          {
            name: "example.com.",
            type: 5,
            ttl: 123,
            data: "alias.example.net.",
          },
          { name: "alias.example.net.", type: 1, ttl: 61, data: "192.0.2.7" },
        ]);
        assert.ok(result.checkedAt >= start && result.checkedAt <= Date.now());
      }
    }
    assert.equal(calls.length, 10);
    calls.forEach(({ url, init }, index) => {
      assert.equal(
        url.origin + url.pathname,
        index < 5
          ? "https://cloudflare-dns.com/dns-query"
          : "https://dns.google/resolve",
      );
      assert.equal(url.searchParams.get("name"), "example.com");
      assert.equal(
        url.searchParams.get("type"),
        dnsTypes[index % dnsTypes.length],
      );
      assert.equal(init.headers.Accept, "application/dns-json");
      assert.equal(init.credentials, "omit");
      assert.equal(init.cache, "no-store");
    });
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("NOERROR without records and DNS errors remain distinct from HTTP or malformed responses", async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ Status: 0 });
    assert.deepEqual(
      (
        await queryDns(
          "example.com",
          "google",
          "TXT",
          new AbortController().signal,
        )
      ).answers,
      [],
    );
    globalThis.fetch = async () => Response.json({ Status: 3 });
    const missing = await queryDns(
      "example.com",
      "google",
      "A",
      new AbortController().signal,
    );
    assert.equal(missing.status, 3);
    assert.deepEqual(missing.answers, []);
    globalThis.fetch = async () => Response.json({ Status: 2 });
    assert.equal(
      (
        await queryDns(
          "example.com",
          "cloudflare",
          "A",
          new AbortController().signal,
        )
      ).status,
      2,
    );
    globalThis.fetch = async () => new Response("down", { status: 503 });
    await assert.rejects(
      queryDns("example.com", "cloudflare", "A", new AbortController().signal),
      /503/,
    );
    globalThis.fetch = async () =>
      Response.json({
        Status: 0,
        Answer: [{ name: "example.com.", type: 1, TTL: -1, data: "192.0.2.7" }],
      });
    await assert.rejects(
      queryDns("example.com", "google", "A", new AbortController().signal),
    );
    globalThis.fetch = async () => {
      throw new TypeError("network unavailable");
    };
    await assert.rejects(
      queryDns("example.com", "google", "A", new AbortController().signal),
      /network unavailable/,
    );
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("DNS request preserves cancellation from the caller", async () => {
  const oldFetch = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = async (_input, init) => {
    assert.equal(init.signal.aborted, true);
    init.signal.throwIfAborted();
    throw new Error("unreachable");
  };
  try {
    controller.abort();
    await assert.rejects(
      queryDns("example.com", "cloudflare", "AAAA", controller.signal),
      { name: "AbortError" },
    );
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("truncated DNS responses retain partial answers and cannot be mistaken for complete empty results", async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ Status: 0, TC: true });
    const empty = await queryDns(
      "example.com",
      "google",
      "TXT",
      new AbortController().signal,
    );
    assert.equal(empty.truncated, true);
    assert.deepEqual(empty.answers, []);

    globalThis.fetch = async () =>
      Response.json({
        Status: 0,
        TC: true,
        Answer: [{ name: "example.com.", type: 1, TTL: 30, data: "192.0.2.7" }],
      });
    const partial = await queryDns(
      "example.com",
      "cloudflare",
      "A",
      new AbortController().signal,
    );
    assert.equal(partial.truncated, true);
    assert.deepEqual(partial.answers, [
      { name: "example.com.", type: 1, ttl: 30, data: "192.0.2.7" },
    ]);

    globalThis.fetch = async () => Response.json({ Status: 0, TC: false });
    const complete = await queryDns(
      "example.com",
      "google",
      "TXT",
      new AbortController().signal,
    );
    assert.equal(complete.truncated, false);
    assert.deepEqual(complete.answers, []);

    globalThis.fetch = async () => Response.json({ Status: 0, TC: "true" });
    await assert.rejects(
      queryDns("example.com", "google", "TXT", new AbortController().signal),
    );
  } finally {
    globalThis.fetch = oldFetch;
  }
});
