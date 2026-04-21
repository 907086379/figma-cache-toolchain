#!/usr/bin/env node
"use strict";

/**
 * Apply auto-link suggestions into figma-cache/index.json flows.
 *
 * This is designed to be used after:
 *   auto-link-related-from-batch.cjs -> auto-related-suggestions.json
 *
 * Usage:
 *   node scripts/apply-auto-related-suggestions.cjs --suggestions=<path> --pairs=<from->to,from->to>
 *
 * Options:
 *   --index=<path>          (default: figma-cache/index.json)
 *   --flow=<flowId>         (default: suggestions.flowId || "auto-related")
 *   --type=<edgeType>       (default: related_confirmed)
 *   --pairs=<csv>           required. Each pair: <fromCacheKey>-><toCacheKey>
 *   --dry-run               do not write index
 */

const fs = require("fs");
const path = require("path");
const { parseCli } = require("./cli-args.cjs");

const ROOT = process.cwd();

function safeReadJson(abs) {
  try {
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(abs, value) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeNodeId(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  return value.includes(":") ? value : value.replace(/-/g, ":");
}

function normalizeCacheKey(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  const parts = value.split("#");
  if (parts.length !== 2) return value;
  return `${parts[0]}#${normalizeNodeId(parts[1])}`;
}

function parseArgs() {
  const { values, flags } = parseCli(process.argv, {
    strings: ["suggestions", "index", "flow", "type", "pairs"],
    booleanFlags: ["dry-run"],
  });
  const pairsRaw = (values.pairs || "").trim();
  const pairs = pairsRaw
    ? pairsRaw
        .split(",")
        .map((s) => String(s || "").trim())
        .filter(Boolean)
    : [];
  return {
    suggestions: (values.suggestions || "").trim(),
    index: (values.index || "").trim() || path.join(ROOT, "figma-cache", "index.json"),
    flowId: (values.flow || "").trim(),
    type: (values.type || "").trim() || "related_confirmed",
    pairs,
    dryRun: Boolean(flags["dry-run"]),
  };
}

function ensureFlow(index, flowId) {
  index.flows = index.flows || {};
  if (!index.flows[flowId]) {
    index.flows[flowId] = {
      id: flowId,
      title: flowId,
      description: "Manually confirmed auto-link suggestions",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [],
      edges: [],
      assumptions: [],
      openQuestions: [],
    };
  }
  return index.flows[flowId];
}

function addNode(flow, cacheKey) {
  flow.nodes = flow.nodes || [];
  if (!flow.nodes.includes(cacheKey)) flow.nodes.push(cacheKey);
}

function hasEdge(flow, from, to, type) {
  const edges = Array.isArray(flow.edges) ? flow.edges : [];
  return edges.some((e) => e && e.from === from && e.to === to && e.type === type);
}

function addEdge(flow, from, to, type, note) {
  if (hasEdge(flow, from, to, type)) return false;
  flow.edges = flow.edges || [];
  flow.edges.push({
    id: `${from}->${to}:${type}:${Date.now()}`,
    from,
    to,
    type,
    note: note || "",
    createdAt: new Date().toISOString(),
  });
  return true;
}

function main() {
  const args = parseArgs();
  if (!args.suggestions || !args.pairs.length) {
    console.error(
      "Usage: node scripts/apply-auto-related-suggestions.cjs --suggestions=<path> --pairs=<from->to,from->to> [--flow=...] [--type=...] [--dry-run]"
    );
    process.exit(2);
  }

  const suggestionsAbs = path.isAbsolute(args.suggestions) ? args.suggestions : path.join(ROOT, args.suggestions);
  const indexAbs = path.isAbsolute(args.index) ? args.index : path.join(ROOT, args.index);
  const s = safeReadJson(suggestionsAbs);
  const index = safeReadJson(indexAbs);
  if (!s || typeof s !== "object") {
    console.error(`[apply-auto-related-suggestions] invalid suggestions json: ${suggestionsAbs}`);
    process.exit(2);
  }
  if (!index || typeof index !== "object") {
    console.error(`[apply-auto-related-suggestions] invalid index json: ${indexAbs}`);
    process.exit(2);
  }

  const flowId = String(args.flowId || s.flowId || "auto-related").trim();
  const flow = ensureFlow(index, flowId);

  const allowedPairs = new Set(
    (Array.isArray(s.suggestions) ? s.suggestions : []).map((x) => `${x.from}->${x.to}`)
  );

  let applied = 0;
  args.pairs.forEach((pairRaw) => {
    const pair = String(pairRaw || "").trim();
    const m = pair.split("->");
    if (m.length !== 2) return;
    const from = normalizeCacheKey(m[0]);
    const to = normalizeCacheKey(m[1]);
    if (!from || !to) return;

    // Safety: only apply pairs that are actually in the suggestions list.
    if (!allowedPairs.has(`${from}->${to}`)) {
      console.error(`[apply-auto-related-suggestions] skipped (not suggested): ${from}->${to}`);
      return;
    }

    addNode(flow, from);
    addNode(flow, to);
    if (addEdge(flow, from, to, args.type, "confirmed from suggestions")) applied += 1;
  });

  flow.updatedAt = new Date().toISOString();
  index.updatedAt = new Date().toISOString();

  if (!args.dryRun) writeJson(indexAbs, index);
  console.log(
    `[apply-auto-related-suggestions] ok applied=${applied} flow=${flowId} dryRun=${args.dryRun ? "1" : "0"}`
  );
}

main();

