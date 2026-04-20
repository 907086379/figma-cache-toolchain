"use strict";

const assert = require("assert");
const {
  getRelatedCacheKeysFromIndex,
  itemCacheKeyFromItem,
} = require("../figma-cache/js/related-cache-keys");

{
  const index = {
    flows: {
      f1: {
        edges: [
          { from: "A#1:1", to: "A#1:2", type: "related_auto" },
          { from: "A#1:1", to: "A#1:3", type: "related_confirmed" },
          { from: "A#1:9", to: "A#1:10", type: "next_step" },
        ],
      },
    },
  };
  assert.deepStrictEqual(getRelatedCacheKeysFromIndex("A#1:1", index), ["A#1:2", "A#1:3"]);
  assert.deepStrictEqual(getRelatedCacheKeysFromIndex("A#1:2", index), ["A#1:1"]);
  assert.deepStrictEqual(getRelatedCacheKeysFromIndex("A#1:3", index), ["A#1:1"]);
  assert.deepStrictEqual(getRelatedCacheKeysFromIndex("A#1:9", index), []);
}

{
  const item = { fileKey: "fk", nodeId: "9:10", scope: "node" };
  assert.strictEqual(itemCacheKeyFromItem(item), "fk#9:10");
  assert.strictEqual(itemCacheKeyFromItem({ fileKey: "fk", scope: "file" }), "fk#__FILE__");
}

console.log("related-cache-keys.test: ok");
