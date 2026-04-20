"use strict";

/**
 * MCP raw → raw.json 派生字段的纯函数（无 fs），供 entry-files hydrate 与 CLI merge 脚本复用。
 */

function mergeLayoutMetricsFromGeometry(raw, geometry) {
  if (!raw || typeof raw !== "object") {
    return raw;
  }
  if (!geometry || typeof geometry !== "object" || !Array.isArray(geometry.metrics)) {
    return raw;
  }
  if (!geometry.metrics.length) {
    return raw;
  }
  const existing = Array.isArray(raw.layoutMetrics) ? raw.layoutMetrics : [];
  const byId = new Map(
    existing.map((m) => [String(m && m.id ? m.id : "").trim(), m]).filter(([k]) => k)
  );
  geometry.metrics.forEach((m) => {
    const id = String(m && m.id ? m.id : "").trim();
    if (!id) return;
    byId.set(id, m);
  });
  raw.layoutMetrics = Array.from(byId.values()).sort((a, b) =>
    String(a.id).localeCompare(String(b.id))
  );
  return raw;
}

function buildEvidenceSummary(input) {
  const {
    designContextText = "",
    metadataText = "",
    variableDefs = null,
    nodeId = "",
    geometryFilePresent = false,
    iconMetricsCount = 0,
    layoutMetricsCount = 0,
  } = input || {};

  const dc = String(designContextText);
  const meta = String(metadataText);
  const designContextBytes = Buffer.byteLength(dc, "utf8");
  const metadataBytes = Buffer.byteLength(meta, "utf8");
  const dataNodeIdRefs = (dc.match(/data-node-id="/g) || []).length;
  const scopeNodeId = String(nodeId || "").trim();
  const dataNodeIdContainsScope =
    scopeNodeId && dc.length ? dc.includes(`data-node-id="${scopeNodeId}"`) : null;
  const designContextImgConstDefinitions = (
    dc.match(/\bconst\s+img[A-Za-z0-9_]*\s*=\s*"https:\/\/www\.figma\.com\/api\/mcp\/asset\//g) || []
  ).length;
  const imgTagOccurrences = (dc.match(/<img\b/gi) || []).length;
  const figmaAssetUrlOccurrences = (dc.match(/https:\/\/www\.figma\.com\/api\/mcp\/asset\//g) || []).length;
  const approximateHexColorLiterals = (
    dc.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g) || []
  ).length;
  const variableDefKeys =
    variableDefs && typeof variableDefs === "object" && !Array.isArray(variableDefs)
      ? Object.keys(variableDefs).length
      : 0;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    designContextBytes,
    metadataBytes,
    dataNodeIdRefs,
    dataNodeIdContainsScope,
    designContextImgConstDefinitions,
    imgTagOccurrences,
    figmaAssetUrlOccurrences,
    approximateHexColorLiterals,
    variableDefKeys,
    geometryFilePresent,
    iconMetricsCount,
    layoutMetricsCount,
  };
}

module.exports = {
  mergeLayoutMetricsFromGeometry,
  buildEvidenceSummary,
};
