"use strict";

/**
 * Derive peer cacheKeys from index.json flows: undirected edges whose type starts with "related"
 * (e.g. related_auto, related_confirmed).
 */

function itemCacheKeyFromItem(item) {
  if (!item || !item.fileKey) {
    return "";
  }
  if (item.scope === "file" || !item.nodeId) {
    return `${item.fileKey}#__FILE__`;
  }
  return `${item.fileKey}#${item.nodeId}`;
}

function collectRelatedNeighborMap(index) {
  const flows = index && typeof index.flows === "object" ? index.flows : {};
  /** @type {Map<string, Set<string>>} */
  const neighbors = new Map();
  function link(a, b) {
    const x = String(a || "").trim();
    const y = String(b || "").trim();
    if (!x || !y || x === y) return;
    if (!neighbors.has(x)) neighbors.set(x, new Set());
    if (!neighbors.has(y)) neighbors.set(y, new Set());
    neighbors.get(x).add(y);
    neighbors.get(y).add(x);
  }
  Object.values(flows).forEach((flow) => {
    if (!flow || !Array.isArray(flow.edges)) return;
    flow.edges.forEach((edge) => {
      if (!edge || !edge.from || !edge.to) return;
      const t = String(edge.type || "").trim().toLowerCase();
      if (!t.startsWith("related")) return;
      link(edge.from, edge.to);
    });
  });
  return neighbors;
}

function getRelatedCacheKeysFromIndex(cacheKey, index) {
  const key = String(cacheKey || "").trim();
  if (!key) return [];
  const neighbors = collectRelatedNeighborMap(index);
  const set = neighbors.get(key);
  if (!set || !set.size) return [];
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

module.exports = {
  itemCacheKeyFromItem,
  getRelatedCacheKeysFromIndex,
  collectRelatedNeighborMap,
};
