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
        assert.equal(request.headers.has("Content-Length"), false);
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
    new Request(request.url, {
      method: "HEAD",
      headers: { "Content-Length": "0" },
    }),
    env,
  );
  assert.equal(seen.at(-1).method, "GET");
  assert.equal(seen.at(-1).headers.has("Content-Length"), false);
  assert.equal(await head.text(), "");
  assert.match(head.headers.get("Content-Security-Policy"), /'nonce-/);
});

test("generated 404 document preserves its existing security headers", async () => {
  const notFound = await readFile("dist/404.html", "utf8");
  assert.doesNotMatch(notFound, /http-equiv="content-security-policy"/i);
  const env = {
    ASSETS: {
      fetch: async () =>
        new Response(notFound, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy": "frame-ancestors 'none'",
            "X-Content-Type-Options": "nosniff",
          },
        }),
    },
  };
  for (const path of [
    "/404",
    "/404.html",
    "/404/",
    "//404",
    "/404//",
    "//404.html",
    "/404/?source=test",
  ]) {
    const response = await worker.fetch(
      new Request(`https://example.com${path}`),
      env,
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), notFound);
    assert.equal(
      response.headers.get("Content-Security-Policy"),
      "frame-ancestors 'none'",
    );
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    const head = await worker.fetch(
      new Request(`https://example.com${path}`, {
        method: "HEAD",
        headers: { "Content-Length": "0" },
      }),
      env,
    );
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal(
      head.headers.get("Content-Security-Policy"),
      "frame-ancestors 'none'",
    );
  }
  for (const path of ["/unexpected", "/404/other", "/not404", "/nested/404"]) {
    await assert.rejects(
      worker.fetch(new Request(`https://example.com${path}`), env),
      /missing its CSP meta tag/,
    );
  }
});

test("HEAD with a body-bearing request fetches the document and fallback without forwarding a body", async () => {
  const seen = [];
  const env = {
    ASSETS: {
      fetch: async (request) => {
        seen.push(request);
        assert.equal(request.method, "GET");
        assert.equal(request.body, null);
        assert.equal(request.headers.has("Content-Length"), false);
        assert.equal(request.headers.get("Accept-Language"), "zh-CN");
        return seen.length === 1
          ? new Response("missing", { status: 404 })
          : new Response(html, { headers: { "Content-Type": "text/html" } });
      },
    },
  };
  // Cloudflare represents an incoming HEAD with Content-Length: 0 as body-bearing.
  const controller = new AbortController();
  const request = new Request("https://example.com/ip/1.1.1.1?q=1", {
    method: "POST",
    body: "",
    headers: { "Content-Length": "0", "Accept-Language": "zh-CN" },
    signal: controller.signal,
  });
  Object.defineProperty(request, "method", { value: "HEAD" });
  assert.notEqual(request.body, null);
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
  assert.equal(seen[0].url, "https://example.com/ip/1.1.1.1?q=1");
  assert.equal(seen[1].url, "https://example.com/200");
  controller.abort();
  assert.equal(seen[0].signal.aborted, true);
  assert.equal(seen[1].signal.aborted, true);
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
