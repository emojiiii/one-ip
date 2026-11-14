import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function structuredData(path) {
  const html = readFileSync(path, "utf8");
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(([, json]) => JSON.parse(json));
}

test("home identifies the website and web application with its public repository", () => {
  for (const path of ["dist/index.html", "dist/en.html"]) {
    const data = structuredData(path);
    const page = data.find((item) => item["@type"] === "WebPage");
    const website = data.find((item) => item["@type"] === "WebSite");
    const application = data.find((item) => item["@type"] === "WebApplication");
    assert.ok(page && website && application, path);
    assert.equal(page.isPartOf["@id"], website["@id"], path);
    assert.equal(website.name, "One IP", path);
    assert.deepEqual(website.sameAs, ["https://github.com/emojiiii/one-ip"], path);
    assert.equal(application.url, page.url, path);
    assert.equal(application.sameAs, "https://github.com/emojiiii/one-ip", path);
  }
});

test("tool pages identify their website without describing every page as the application", () => {
  const data = structuredData("dist/zh/ip.html");
  assert.deepEqual(data.map((item) => item["@type"]), ["WebPage", "WebSite"]);
  assert.equal(data[0].isPartOf["@id"], data[1]["@id"]);
  assert.deepEqual(data[1].sameAs, ["https://github.com/emojiiii/one-ip"]);
});
