#!/usr/bin/env node
"use strict";

/**
 * Toolchain-provided icon inset exporter.
 * Reads raw.json.iconMetrics and emits a TS mapping file for machine consumption.
 */

const fs = require("fs");
const path = require("path");

function parseArgs(argv) {
  const out = {
    raw: [],
    out: "",
    maxBox: 24,
    cacheKey: "",
    outDir: "",
  };
  argv.slice(2).forEach((arg) => {
    if (arg.startsWith("--raw=")) out.raw.push(arg.split("=").slice(1).join("=").trim());
    if (arg.startsWith("--out=")) out.out = arg.split("=").slice(1).join("=").trim();
    if (arg.startsWith("--out-dir=")) out.outDir = arg.split("=").slice(1).join("=").trim();
    if (arg.startsWith("--cacheKey=")) out.cacheKey = arg.split("=").slice(1).join("=").trim();
    if (arg.startsWith("--max-box=")) out.maxBox = Number(arg.split("=").slice(1).join("=").trim());
  });
  return out;
}

function readJson(absPath) {
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function formatNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  return String(Number(num.toFixed(4))).replace(/\.0+$/, "");
}

function buildTs(mapping) {
  const lines = [];
  lines.push(`export type InsetsPx = { top: number; right: number; bottom: number; left: number };`);
  lines.push("");
  lines.push("/**");
  lines.push(" * AUTO-GENERATED.");
  lines.push(" * Source: raw.json.iconMetrics (derived from get_design_context inset percentages)");
  lines.push(" */");
  lines.push("export const ICON_INSETS_PX: Record<string, InsetsPx> = {");
  Object.keys(mapping)
    .sort()
    .forEach((key) => {
      const v = mapping[key];
      lines.push(
        `  "${key}": { top: ${formatNumber(v.top)}, right: ${formatNumber(v.right)}, bottom: ${formatNumber(
          v.bottom
        )}, left: ${formatNumber(v.left)} },`
      );
    });
  lines.push("};");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.raw.length || (!args.out && !(args.outDir && args.cacheKey))) {
    console.error(
      "Usage: node scripts/generate-icon-insets.cjs --raw=<raw.json> [--raw=<raw2.json> ...] (--out=<out.ts> | --out-dir=<dir> --cacheKey=<cacheKey>) [--max-box=24]"
    );
    process.exit(2);
  }
  const computedOut = args.out
    ? args.out
    : path.join(
        args.outDir,
        `iconInsets.${String(args.cacheKey || "")
          .replace(/[^a-zA-Z0-9._-]+/g, "_")
          .slice(0, 120)}.generated.ts`
      );
  const outAbs = path.isAbsolute(computedOut) ? computedOut : path.join(process.cwd(), computedOut);

  const mapping = {};
  args.raw.forEach((rawPath) => {
    const rawAbs = path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);
    const data = readJson(rawAbs);
    const list = Array.isArray(data && data.iconMetrics) ? data.iconMetrics : [];
    list.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const nodeId = String(item.nodeId || "").trim();
      const boxPx = Number(item.boxPx);
      const insetPx = item.insetPx;
      if (!nodeId) return;
      if (!Number.isFinite(boxPx) || boxPx <= 0 || boxPx > args.maxBox) return;
      if (!insetPx || typeof insetPx !== "object") return;
      // First write wins to keep stable precedence: primary cacheKey first, related next.
      if (mapping[nodeId]) return;
      mapping[nodeId] = {
        top: Number(insetPx.top || 0),
        right: Number(insetPx.right || 0),
        bottom: Number(insetPx.bottom || 0),
        left: Number(insetPx.left || 0),
      };
    });
  });

  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, buildTs(mapping), "utf8");
  console.log(`[generate-icon-insets] wrote ${Object.keys(mapping).length} entries -> ${outAbs}`);
}

main();

