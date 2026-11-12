import assert from "node:assert/strict";
import { test } from "node:test";
import { bundledModuleUrl } from "./compile.mjs";

const { parseBatchInput, toCsv } = await import(
  bundledModuleUrl("migration/sveltekit/src/lib/ip/batch.ts")
);

test("batch input normalizes and deduplicates IPv4 and IPv6 across supported separators", () => {
  assert.deepEqual(
    parseBatchInput(" 001.001.001.001，8.8.8.8; 2001:0db8::1\n2001:db8::1；1.1.1.1 "),
    { ips: ["1.1.1.1", "8.8.8.8", "2001:db8::1"], invalid: [], tooMany: false },
  );
  assert.deepEqual(parseBatchInput("  \n，; "), {
    ips: [], invalid: [], tooMany: false,
  });
});

test("batch input identifies invalid values and checks the ten-IP limit after deduplication", () => {
  const distinct = Array.from({ length: 10 }, (_, i) => `1.1.1.${i + 1}`);
  const within = parseBatchInput([...distinct, "001.001.001.001", "300.1.1.1", "not-an-ip"].join(","));
  assert.deepEqual(within.ips, distinct);
  assert.deepEqual(within.invalid, ["300.1.1.1", "not-an-ip"]);
  assert.equal(within.tooMany, false);
  const over = parseBatchInput([...distinct, "2001:db8::1"].join("\n"));
  assert.equal(over.tooMany, true);
  assert.equal(over.ips.length, 11);
});

test("CSV protects formulas and correctly quotes commas, quotes, and line breaks", () => {
  const csv = toCsv(["Name", "Location", "Status"], [
    ['hello, "world"\nnext', "Shanghai", "unknown"],
    ["=HYPERLINK(\"https://example.com\")", "+1+1", "@SUM(1,2)"],
    ["-2+3", "normal", ""],
    ["  =1+1", "\tvalue", "\rvalue"],
  ]);
  assert.match(csv, /"hello, ""world""\nnext"/);
  assert.match(csv, /'?=HYPERLINK/);
  for (const value of ["=HYPERLINK", "+1+1", "@SUM", "-2+3"]) {
    assert.ok(csv.includes(`'${value}`), `${value} must be exported as text`);
  }
  for (const value of ["  =1+1", "\tvalue", "\rvalue"]) {
    assert.ok(csv.includes(`'${value}`), "leading whitespace must not bypass formula protection");
  }
  assert.ok(csv.includes("Shanghai"));
  assert.ok(csv.includes("unknown"));
});
