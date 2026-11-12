import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("built pages permit the configured Google Tag Gateway scripts without allowing arbitrary inline scripts", () => {
  for (const path of ["dist/index.html", "dist/zh/ip/batch.html", "dist/200.html"]) {
    const html = readFileSync(path, "utf8");
    const policy = html.match(/<meta http-equiv="content-security-policy" content="([^"]+)"/)?.[1];
    assert.ok(policy, path);
    const scriptSrc = policy.split(";").map((part) => part.trim()).find((part) => part.startsWith("script-src "));
    assert.ok(scriptSrc, path);
    const sources = scriptSrc.split(/\s+/);
    for (const source of [
      "https://www.googletagmanager.com/gtag/",
      "'sha256-NwBB+A/we0a6Jdp1VXan4irqgtum3/5deeAurlmrHRg='",
      "'sha256-7lGaeduHe5P2drtIOROpfyLP5J4hwT8oBGemz7Se9M4='",
    ]) assert.ok(sources.includes(source), `${path}: ${source}`);
    assert.ok(!sources.includes("'unsafe-inline'"), path);
    assert.ok(!sources.includes("https://www.googletagmanager.com"), path);
  }
});
