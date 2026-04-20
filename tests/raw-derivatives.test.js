"use strict";

const assert = require("assert");
const {
  mergeLayoutMetricsFromGeometry,
  buildEvidenceSummary,
} = require("../figma-cache/js/raw-derivatives");

{
  const raw = { layoutMetrics: [{ id: "a", v: 1 }] };
  mergeLayoutMetricsFromGeometry(raw, { metrics: [{ id: "a", v: 2 }, { id: "b", v: 3 }] });
  assert.strictEqual(raw.layoutMetrics.length, 2);
  const byId = Object.fromEntries(raw.layoutMetrics.map((m) => [m.id, m]));
  assert.strictEqual(byId.a.v, 2);
  assert.strictEqual(byId.b.v, 3);
}

{
  const dc = `${'<div data-node-id="9:1"></div>'.repeat(10)}\nconst imgX = "https://www.figma.com/api/mcp/asset/cccccccc-cccc-cccc-cccc-cccccccccccc";\n<img src={imgX} />`;
  const s = buildEvidenceSummary({
    designContextText: dc,
    metadataText: "<instance/>",
    variableDefs: { a: 1, b: 2 },
    nodeId: "9:1",
    geometryFilePresent: true,
    iconMetricsCount: 3,
    layoutMetricsCount: 4,
  });
  assert.strictEqual(s.version, 1);
  assert.ok(s.generatedAt);
  assert.ok(s.dataNodeIdRefs >= 10);
  assert.strictEqual(s.dataNodeIdContainsScope, true);
  assert.ok(s.designContextImgConstDefinitions >= 1);
  assert.ok(s.imgTagOccurrences >= 1);
  assert.strictEqual(s.variableDefKeys, 2);
  assert.strictEqual(s.geometryFilePresent, true);
  assert.strictEqual(s.iconMetricsCount, 3);
  assert.strictEqual(s.layoutMetricsCount, 4);
}

console.log("raw-derivatives.test: ok");
