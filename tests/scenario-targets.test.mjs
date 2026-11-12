import assert from "node:assert/strict";
import { test } from "node:test";
import { bundledModuleUrl } from "./compile.mjs";
const { getScenarioTargets } = await import(bundledModuleUrl("migration/sveltekit/src/lib/ip/scenario-targets.ts"));
const { accessTargets, scenarioGroups } = getScenarioTargets("en");

test("every scenario has diverse, distinct public targets instead of manual-only placeholders", () => {
  assert.ok(scenarioGroups.length >= 12);
  for (const group of scenarioGroups) {
    assert.ok(group.targets.length >= 5, group.id);
    assert.equal(
      new Set(group.targets.map((target) => target.url)).size,
      group.targets.length,
    );
    assert.ok(
      new Set(
        group.targets.map(
          (target) => new URL(target.website ?? target.url).hostname,
        ),
      ).size >= 5,
    );
    for (const target of group.targets) {
      const url = new URL(target.url);
      assert.equal(url.protocol, "https:");
      assert.equal(url.username, "");
      assert.equal(url.password, "");
      assert.ok(target.name);
    }
  }
});
test("initial work is interleaved so later scenarios do not wait for earlier groups", () => {
  assert.deepEqual(
    accessTargets.slice(0, scenarioGroups.length),
    scenarioGroups.map((group) => group.targets[0]),
  );
  assert.equal(
    accessTargets.length,
    scenarioGroups.reduce((sum, group) => sum + group.targets.length, 0),
  );
});

test("scenario labels use the selected locale without changing probe identities", () => {
  const chinese = getScenarioTargets("zh-CN");
  assert.notEqual(chinese.scenarioGroups[0].label, scenarioGroups[0].label);
  assert.deepEqual(chinese.accessTargets.map(({ id }) => id), accessTargets.map(({ id }) => id));
});
