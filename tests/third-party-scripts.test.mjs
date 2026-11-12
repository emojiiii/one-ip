import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("built pages include analytics and AdSense with a CSP that permits their resources", () => {
  for (const path of [
    "dist/index.html",
    "dist/zh/ip/batch.html",
    "dist/200.html",
  ]) {
    const html = readFileSync(path, "utf8");
    assert.match(html, /static\.cloudflareinsights\.com\/beacon\.min\.js/);
    assert.match(html, /a83550cb27fe475894378a8b67bfc788/);
    assert.match(
      html,
      /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-1891105577332911/,
    );
    assert.match(
      html,
      /name="google-adsense-account" content="ca-pub-1891105577332911"/,
    );
    const policy = html.match(
      /<meta http-equiv="content-security-policy" content="([^"]+)"/,
    )?.[1];
    assert.ok(policy, path);
    const directives = new Map(
      policy.split(";").map((part) => {
        const [name, ...sources] = part.trim().split(/\s+/);
        return [name, sources];
      }),
    );
    assert.ok(directives.get("script-src").includes("https:"), path);
    assert.ok(directives.get("script-src").includes("'unsafe-eval'"), path);
    assert.ok(directives.get("frame-src").includes("https:"), path);
  }
  assert.equal(
    readFileSync("dist/ads.txt", "utf8").trim(),
    "google.com, pub-1891105577332911, DIRECT, f08c47fec0942fa0",
  );
});
