#!/usr/bin/env node
"use strict";

const assert = require("assert");
const { parseCli } = require("../scripts/cli-args.cjs");

function run() {
  const a = parseCli(["node", "x.js", "--batch=./b.json", "--file", "--", "c.vue"], {
    strings: ["batch", "cacheKey"],
    arrays: ["file"],
    booleanFlags: [],
  });
  assert.strictEqual(a.values.batch, "./b.json");
  assert.deepStrictEqual(a.arrays.file, ["c.vue"]);

  const b = parseCli(["node", "x.js", "--cacheKey", "k#1", "--target", "t.vue"], {
    strings: ["cacheKey", "target", "mode"],
    booleanFlags: [],
  });
  assert.strictEqual(b.values.cacheKey, "k#1");
  assert.strictEqual(b.values.target, "t.vue");

  const c = parseCli(["node", "x.js", "--no-filter-remote-figma-assets"], {
    strings: [],
    booleanFlags: ["no-filter-remote-figma-assets"],
  });
  assert.strictEqual(c.flags["no-filter-remote-figma-assets"], true);

  const d = parseCli(["node", "x.js", "--raw", "a.json", "--raw=b.json"], {
    strings: [],
    arrays: ["raw"],
    booleanFlags: [],
  });
  assert.deepStrictEqual(d.arrays.raw, ["a.json", "b.json"]);

  console.log("cli-args.test: ok");
}

run();
