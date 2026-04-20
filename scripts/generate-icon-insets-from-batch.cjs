#!/usr/bin/env node
"use strict";

/**
 * Generate iconInsets.<cacheKey>.generated.ts for each batch item.
 * Output directory defaults to the target component directory (dirname(target)).
 *
 * Usage:
 *   node scripts/generate-icon-insets-from-batch.cjs --batch=./figma-e2e-batch.json
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.cwd();
const DEFAULT_INDEX_ABS = path.join(ROOT, "figma-cache", "index.json");

function normalizeNodeId(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  return value.includes(":") ? value : value.replace(/-/g, ":");
}

function cacheKeyFromItem(item) {
  const fileKey = String(item && item.fileKey ? item.fileKey : "").trim();
  const nodeId = String(item && item.nodeId ? item.nodeId : "").trim();
  if (!fileKey || !nodeId) return "";
  return `${fileKey}#${normalizeNodeId(nodeId)}`;
}

function normalizeCacheKey(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  const parts = value.split("#");
  if (parts.length !== 2) return value;
  return `${parts[0]}#${normalizeNodeId(parts[1])}`;
}

function toRelatedCacheKeys(item) {
  const raw = item && item.relatedCacheKeys;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(normalizeCacheKey).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => normalizeCacheKey(s))
      .filter(Boolean);
  }
  return [];
}

function extractCacheKeyFromFigmaUrl(url) {
  const input = String(url || "").trim();
  if (!input) return "";
  // Matches:
  // https://www.figma.com/design/<fileKey>/... ?node-id=9277-28552
  // https://www.figma.com/file/<fileKey>/... ?node-id=9277%3A28552
  const fileKeyMatch = input.match(/figma\.com\/(?:design|file)\/([^/]+)/i);
  const nodeIdMatch = input.match(/[?&]node-id=([^&]+)/i);
  if (!fileKeyMatch || !nodeIdMatch) return "";
  const fileKey = String(fileKeyMatch[1] || "").trim();
  const decodedNode = decodeURIComponent(String(nodeIdMatch[1] || "").trim());
  const nodeId = normalizeNodeId(decodedNode);
  if (!fileKey || !nodeId) return "";
  return `${fileKey}#${nodeId}`;
}

function toRelatedUrls(item) {
  const raw = item && item.relatedUrls;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((u) => String(u || "").trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => String(s || "").trim())
      .filter(Boolean);
  }
  return [];
}

function safeReadJson(absPath) {
  try {
    return JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch {
    return null;
  }
}

function relatedFromFlowIndex(cacheKey) {
  const enabled = process.env.FIGMA_UI_RELATED_FROM_FLOW !== "0";
  if (!enabled) return [];
  const index = safeReadJson(DEFAULT_INDEX_ABS);
  if (!index || typeof index !== "object" || !index.flows) return [];
  const flows = index.flows;
  const related = new Set();
  Object.keys(flows).forEach((flowId) => {
    const flow = flows[flowId];
    const nodes = flow && Array.isArray(flow.nodes) ? flow.nodes : [];
    if (!nodes.includes(cacheKey)) return;
    nodes.forEach((k) => {
      if (k && k !== cacheKey) related.add(normalizeCacheKey(k));
    });
  });
  return Array.from(related).filter(Boolean);
}

function resolveTargetAbs(rawTarget) {
  const trimmed = String(rawTarget || "").trim();
  if (!trimmed) return "";
  return path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.join(ROOT, trimmed);
}

function parseArgs(argv) {
  const out = {
    batch: path.join(ROOT, "figma-e2e-batch.json"),
    maxBox: 24,
    toolchainGenerateScript: path.join(__dirname, "generate-icon-insets.cjs"),
  };
  argv.slice(2).forEach((arg) => {
    if (arg.startsWith("--batch=")) out.batch = arg.split("=").slice(1).join("=").trim();
    if (arg.startsWith("--max-box=")) out.maxBox = Number(arg.split("=").slice(1).join("=").trim());
  });
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  const batchAbs = path.isAbsolute(args.batch) ? args.batch : path.join(ROOT, args.batch);
  if (!fs.existsSync(batchAbs)) {
    console.error(`[generate-icon-insets-from-batch] batch not found: ${batchAbs}`);
    process.exit(2);
  }
  const payload = JSON.parse(fs.readFileSync(batchAbs, "utf8"));
  if (!Array.isArray(payload) || payload.length === 0) {
    console.error("[generate-icon-insets-from-batch] batch must be a non-empty array");
    process.exit(2);
  }

  const genAbs = args.toolchainGenerateScript;
  if (!fs.existsSync(genAbs)) {
    console.error(`[generate-icon-insets-from-batch] missing generator: ${genAbs}`);
    process.exit(2);
  }

  const outputs = [];
  payload.forEach((item, idx) => {
    const cacheKey = String(item && (item.cacheKey || cacheKeyFromItem(item)) || "").trim();
    const targetAbs = resolveTargetAbs(item && item.target);
    const relatedCacheKeysExplicit = toRelatedCacheKeys(item);
    const relatedCacheKeysFromUrls = toRelatedUrls(item)
      .map(extractCacheKeyFromFigmaUrl)
      .map(normalizeCacheKey)
      .filter(Boolean);
    const relatedCacheKeysFromFlow = relatedFromFlowIndex(cacheKey);
    const relatedCacheKeys = Array.from(
      new Set([...relatedCacheKeysExplicit, ...relatedCacheKeysFromUrls, ...relatedCacheKeysFromFlow])
    ).filter(Boolean);
    if (!cacheKey) {
      console.error(`[generate-icon-insets-from-batch] case[${idx}] missing cacheKey or (fileKey+nodeId)`);
      process.exit(2);
    }
    if (!targetAbs) {
      console.error(`[generate-icon-insets-from-batch] case[${idx}] missing target`);
      process.exit(2);
    }
    const targetDir = path.dirname(targetAbs);
    const rawArgs = [cacheKey, ...relatedCacheKeys]
      .map((ck) => {
        const [fk, nid] = String(ck).split("#");
        const safeNodeDir = String(nid || "").replace(/:/g, "-");
        const rawAbs = path.join(ROOT, "figma-cache", "files", fk, "nodes", safeNodeDir, "raw.json");
        if (!fs.existsSync(rawAbs)) {
          console.error(`[generate-icon-insets-from-batch] raw.json not found for ${ck}: ${rawAbs}`);
          process.exit(2);
        }
        return `--raw="${rawAbs}"`;
      })
      .join(" ");

    execSync(`node "${genAbs}" ${rawArgs} --out-dir="${targetDir}" --cacheKey="${cacheKey}" --max-box=${args.maxBox}`, {
      cwd: ROOT,
      stdio: "pipe",
    });
    outputs.push({ cacheKey, outDir: targetDir });
  });

  console.log(
    `[generate-icon-insets-from-batch] ok (${outputs.length} cases)`
  );
}

main();

