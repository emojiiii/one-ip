import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { workerCatalog } from "./service-catalog.mjs";
import { bundledModuleUrl } from "./compile.mjs";
const json = (path) => JSON.parse(readFileSync(path, "utf8"));

test("AI platform status links resolve to synchronized service entries", async () => {
  const { aiPlatforms } = await import(bundledModuleUrl("migration/sveltekit/src/routes/unlock/ai/platforms.ts"));
  const web = json("migration/sveltekit/src/routes/status/services.json");
  const worker = json("worker/services.json");
  assert.deepEqual(workerCatalog(web), worker);
  for (const platform of aiPlatforms) {
    const service = web.find((entry) => entry.id === platform.statusId);
    assert.ok(service, platform.name);
    assert.equal(service.group, "AI");
    assert.ok(service.icon);
    if (!service.url) assert.ok(service.note);
  }
});
