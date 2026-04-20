#!/usr/bin/env node
"use strict";

/**
 * Upsert one case into figma-e2e-batch.json with a strict PascalCase default component name.
 *
 * Why this exists in toolchain:
 * - Batch config is part of the toolchain workflow (UI e2e automation).
 * - Default naming must be consistent across target projects.
 *
 * Default naming:
 * - nodeId 9277-28654 -> FigmaNode9277x28654 (strict PascalCase, traceable to node-id)
 *
 * Usage:
 *   node scripts/batch-add.cjs "<figma-url|cacheKey|node-id>" [--batch=figma-e2e-batch.json] [--fileKey=...] [--target=...] [--target-root=...] [--component=...]
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DEFAULT_BATCH = "figma-e2e-batch.json";
const DEFAULT_UI_BATCH_CONFIG = "figma-ui-batch.config.json";

function readJsonIfExists(absPath) {
  if (!fs.existsSync(absPath)) {
    return undefined;
  }
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function readUiBatchConfig() {
  const configPath = path.join(ROOT, DEFAULT_UI_BATCH_CONFIG);
  const raw = readJsonIfExists(configPath);
  if (!raw || typeof raw !== "object") {
    return { configPath, config: null };
  }
  const config = raw && raw.uiBatch && typeof raw.uiBatch === "object" ? raw.uiBatch : raw;
  if (!config || typeof config !== "object") {
    return { configPath, config: null };
  }
  return { configPath, config };
}

function writeJson(absPath, payload) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function normalizeNodeIdForBatch(nodeId) {
  const raw = String(nodeId || "").trim();
  if (!raw) return "";
  // Batch uses Figma URL style: 9278-30676
  return raw.includes("-") ? raw : raw.replace(/:/g, "-");
}

function normalizeNodeIdForCacheKey(nodeId) {
  const raw = String(nodeId || "").trim();
  if (!raw) return "";
  // cacheKey uses 9278:30676
  return raw.includes(":") ? raw : raw.replace(/-/g, ":");
}

function tryParseFigmaUrl(input) {
  try {
    const url = new URL(String(input));
    const m = url.pathname.match(/^\/design\/([^/]+)/);
    const fileKey = m ? m[1] : "";
    const nodeId = url.searchParams.get("node-id") || "";
    if (!fileKey || !nodeId) return undefined;
    return { fileKey, nodeId: normalizeNodeIdForBatch(nodeId) };
  } catch {
    return undefined;
  }
}

function tryParseCacheKey(input) {
  const raw = String(input || "").trim();
  const m = raw.match(/^([A-Za-z0-9]+)#(\d+[:\-]\d+)$/);
  if (!m) return undefined;
  return { fileKey: m[1], nodeId: normalizeNodeIdForBatch(m[2]) };
}

function tryParseNodeIdOnly(input) {
  const raw = String(input || "").trim();
  if (!raw) return undefined;
  const m1 = raw.match(/node-id=([0-9]+-[0-9]+)/);
  if (m1) return { nodeId: normalizeNodeIdForBatch(m1[1]) };
  const m2 = raw.match(/^(\d+[-:]\d+)$/);
  if (m2) return { nodeId: normalizeNodeIdForBatch(m2[1]) };
  return undefined;
}

function parseArgs(argv) {
  const out = {
    input: "",
    batch: DEFAULT_BATCH,
    fileKey: "",
    nodeId: "",
    target: "",
    targetRoot: "",
    component: "",
    minScore: 85,
    maxWarnings: 10,
    maxDiffs: 10,
  };

  const raw = argv.slice(2);
  out.input = raw[0] ? String(raw[0]).trim() : "";

  raw.slice(1).forEach((arg) => {
    if (arg.startsWith("--batch=")) out.batch = arg.split("=").slice(1).join("=").trim();
    else if (arg.startsWith("--fileKey=")) out.fileKey = arg.split("=").slice(1).join("=").trim();
    else if (arg.startsWith("--nodeId="))
      out.nodeId = normalizeNodeIdForBatch(arg.split("=").slice(1).join("=").trim());
    else if (arg.startsWith("--target=")) out.target = arg.split("=").slice(1).join("=").trim();
    else if (arg.startsWith("--target-root=")) out.targetRoot = arg.split("=").slice(1).join("=").trim();
    else if (arg.startsWith("--component=")) out.component = arg.split("=").slice(1).join("=").trim();
    else if (arg.startsWith("--minScore=")) out.minScore = Number(arg.split("=").slice(1).join("=").trim());
    else if (arg.startsWith("--maxWarnings="))
      out.maxWarnings = Number(arg.split("=").slice(1).join("=").trim());
    else if (arg.startsWith("--maxDiffs=")) out.maxDiffs = Number(arg.split("=").slice(1).join("=").trim());
  });

  return out;
}

function inferFileKeyFromExistingBatch(batchAbs) {
  const payload = readJsonIfExists(batchAbs);
  if (!Array.isArray(payload) || payload.length === 0) return "";
  const keys = Array.from(
    new Set(payload.map((x) => (x && x.fileKey ? String(x.fileKey).trim() : "")).filter(Boolean))
  );
  return keys.length === 1 ? keys[0] : "";
}

function isStrictPascalCase(input) {
  return /^[A-Z][A-Za-z0-9]*$/.test(String(input || "").trim());
}

function defaultComponentName(nodeIdBatch) {
  const raw = String(nodeIdBatch || "").trim();
  const m = raw.match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (m) return `FigmaNode${m[1]}x${m[2]}`;
  const safe = raw.replace(/[^0-9A-Za-z]+/g, "");
  return `FigmaNode${safe || "Unknown"}`;
}

function normalizeTargetRoot(input) {
  const raw = String(input || "").trim().replace(/\\/g, "/");
  if (!raw) return "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function renderTargetTemplate(template, vars) {
  const raw = String(template || "");
  if (!raw) return "";
  // Simple token replacement; keeps script dependency-free.
  return raw
    .replace(/\{targetRoot\}/g, String(vars.targetRoot || ""))
    .replace(/\{component\}/g, String(vars.component || ""))
    .replace(/\{fileKey\}/g, String(vars.fileKey || ""))
    .replace(/\{nodeId\}/g, String(vars.nodeId || ""));
}

function resolveTarget({ target, component, nodeId, targetRoot }) {
  if (target) return target;
  const comp = component || defaultComponentName(nodeId);
  const { config } = readUiBatchConfig();
  const resolvedRoot =
    normalizeTargetRoot(targetRoot) ||
    normalizeTargetRoot(process.env.FIGMA_UI_BATCH_TARGET_ROOT) ||
    normalizeTargetRoot(config && config.targetRoot) ||
    "./src/pages/main/components";

  const resolvedTemplate =
    String(process.env.FIGMA_UI_BATCH_TARGET_TEMPLATE || "").trim() ||
    String(config && config.targetTemplate ? config.targetTemplate : "").trim() ||
    "{targetRoot}/{component}/index.vue";

  const rendered = renderTargetTemplate(resolvedTemplate, {
    targetRoot: resolvedRoot,
    component: comp,
    nodeId: normalizeNodeIdForBatch(nodeId),
  }).replace(/\\/g, "/");

  if (!rendered || !rendered.includes(String(comp))) {
    // Safety fallback: never emit an empty / suspicious target.
    return `${resolvedRoot}/${comp}/index.vue`;
  }

  return rendered;
}

function upsertCase(batchPayload, item) {
  const next = Array.isArray(batchPayload) ? [...batchPayload] : [];
  const idx = next.findIndex((x) => x && x.fileKey === item.fileKey && x.nodeId === item.nodeId);
  if (idx >= 0) {
    next[idx] = { ...next[idx], ...item };
    return { payload: next, action: "updated" };
  }
  next.push(item);
  return { payload: next, action: "added" };
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.input) {
    console.error(
      [
        "usage:",
        '  node scripts/batch-add.cjs "<figma-url|cacheKey|node-id>" [--fileKey=...] [--target=...] [--target-root=...] [--component=...]',
        "",
        "component naming:",
        "- default is strict PascalCase and traceable to node-id, e.g. 9277-28654 -> FigmaNode9277x28654",
        "- if you pass --component, it must be strict PascalCase (A-Z then alnum only).",
        "",
        "target path:",
        "- by default writes to ./src/pages/main/components/<Component>/index.vue",
        "- override with --target (full path), or set --target-root (directory root)",
        "- you can also set env FIGMA_UI_BATCH_TARGET_ROOT to avoid repeating --target-root",
        "- for engineering setups, create figma-ui-batch.config.json in project root:",
        '  { "uiBatch": { "targetRoot": "./src/ui/components", "targetTemplate": "{targetRoot}/{component}/index.vue" } }',
        "- env override: FIGMA_UI_BATCH_TARGET_TEMPLATE",
        "",
        "examples:",
        '  node scripts/batch-add.cjs "https://www.figma.com/design/<fileKey>/...?node-id=9278-30676"',
        '  node scripts/batch-add.cjs "53hw0wDvgOzH14DXSsnEmE#9278:30676"',
        '  node scripts/batch-add.cjs "9278-30676" --fileKey=53hw0wDvgOzH14DXSsnEmE',
        '  node scripts/batch-add.cjs "9278-30676" --fileKey=53hw0wDvgOzH14DXSsnEmE --target-root=./src/ui/components',
      ].join("\n")
    );
    process.exit(2);
  }

  const batchAbs = path.isAbsolute(args.batch) ? path.normalize(args.batch) : path.join(ROOT, args.batch);

  const parsed = tryParseFigmaUrl(args.input) || tryParseCacheKey(args.input) || tryParseNodeIdOnly(args.input);

  const fileKey =
    String(args.fileKey || "").trim() ||
    (parsed && parsed.fileKey ? String(parsed.fileKey).trim() : "") ||
    inferFileKeyFromExistingBatch(batchAbs);

  const nodeId = String(args.nodeId || "").trim() || (parsed && parsed.nodeId ? String(parsed.nodeId).trim() : "");

  if (!fileKey) {
    console.error(
      [
        "missing fileKey.",
        "- provide a full Figma URL that includes /design/<fileKey> and ?node-id=...",
        "- or provide cacheKey like <fileKey>#9278:30676",
        "- or pass --fileKey=... when using node-id only",
      ].join("\n")
    );
    process.exit(2);
  }

  if (!nodeId) {
    console.error("missing nodeId (expected node-id like 9278-30676 or 9278:30676)");
    process.exit(2);
  }

  if (args.component && !isStrictPascalCase(args.component)) {
    console.error(
      [
        "invalid --component (must be strict PascalCase).",
        `- received: ${JSON.stringify(args.component)}`,
        "- examples: AudioSettingsPanel, CallingWidgetInCallPanel, FigmaNode9277x28654",
      ].join("\n")
    );
    process.exit(2);
  }

  const target = resolveTarget({
    target: args.target,
    component: args.component,
    nodeId,
    targetRoot: args.targetRoot,
  });
  const item = {
    fileKey,
    nodeId: normalizeNodeIdForBatch(nodeId),
    target,
    minScore: Number.isFinite(Number(args.minScore)) ? Number(args.minScore) : 85,
    maxWarnings: Number.isFinite(Number(args.maxWarnings)) ? Number(args.maxWarnings) : 10,
    maxDiffs: Number.isFinite(Number(args.maxDiffs)) ? Number(args.maxDiffs) : 10,
    policy: { allowPrimitives: [] },
  };

  const existing = readJsonIfExists(batchAbs);
  const { payload, action } = upsertCase(existing, item);
  writeJson(batchAbs, payload);

  const cacheKey = `${fileKey}#${normalizeNodeIdForCacheKey(item.nodeId)}`;
  console.log(`[batch-add] ${action}: ${cacheKey}`);
  console.log(`[batch-add] target: ${item.target}`);
}

main();

