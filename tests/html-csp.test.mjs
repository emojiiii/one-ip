import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import worker from "../.worker-test/index.js";

const html = await readFile("dist/zh/ip/batch.html", "utf8");
const meta = html.match(
  /<meta http-equiv="content-security-policy" content="([^"]+)">/i,
);
assert.ok(meta, "the prerendered page must provide its SvelteKit CSP");

test("document CSP is moved to a per-response header with a fresh nonce", async () => {
  const seen = [];
  const env = {
    ASSETS: {
      fetch: async (request) => {
        seen.push(request);
        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy": "frame-ancestors 'none'",
            "Content-Length": "123",
            ETag: '"old"',
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  };
  const request = new Request("https://example.com/zh/ip/batch", {
    headers: { "If-None-Match": '"old"' },
  });
  const first = await worker.fetch(request, env);
  const second = await worker.fetch(request, env);
  const firstPolicy = first.headers.get("Content-Security-Policy");
  const secondPolicy = second.headers.get("Content-Security-Policy");
  assert.match(firstPolicy, /frame-ancestors 'none'/);
  assert.ok(firstPolicy.includes(meta[1].match(/'sha256-[^']+'/)[0]));
  assert.match(firstPolicy, /script-src [^;]*'nonce-[A-Za-z0-9+/]+=*'/);
  assert.notEqual(firstPolicy, secondPolicy);
  assert.equal(first.headers.get("Cache-Control"), "private, no-store");
  assert.equal(first.headers.get("ETag"), null);
  assert.equal(first.headers.get("Content-Length"), null);
  assert.equal(seen[0].headers.has("If-None-Match"), false);
  const body = await first.text();
  assert.doesNotMatch(body, /http-equiv="content-security-policy"/i);
  assert.ok(body.includes("__sveltekit_"));
  const head = await worker.fetch(
    new Request(request.url, { method: "HEAD" }),
    env,
  );
  assert.equal(seen.at(-1).method, "GET");
  assert.equal(await head.text(), "");
  assert.match(head.headers.get("Content-Security-Policy"), /'nonce-/);
});

test("non-HTML assets keep their original cache headers and body", async () => {
  const env = {
    ASSETS: {
      fetch: async () =>
        new Response("asset", {
          headers: {
            "Content-Type": "text/javascript",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  };
  const response = await worker.fetch(
    new Request("https://example.com/_app/test.js"),
    env,
  );
  assert.equal(await response.text(), "asset");
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=3600");
  assert.equal(response.headers.get("Content-Security-Policy"), null);
});
