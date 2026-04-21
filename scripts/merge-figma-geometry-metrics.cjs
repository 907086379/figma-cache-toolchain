#!/usr/bin/env node
"use strict";

/**
 * Merge figma-geometry-metrics.json into raw.json as layoutMetrics[].
 *
 * Geometry file shape:
 * {
 *   "version": 1,
 *   "source": "figma_plugin_absoluteBoundingBox",
 *   "metrics": [ { "id": "...", "kind": "spacer_between_nodes_y", "fromNodeId": "...", "toNodeId": "...", "spacerPx": 26, ... } ]
 * }
 *
 * Usage:
 *   node scripts/merge-figma-geometry-metrics.cjs --raw=<raw.json> --geometry=<figma-geometry-metrics.json>
 */

const fs = require("fs");
const path = require("path");
const { parseCli } = require("./cli-args.cjs");
const { mergeLayoutMetricsFromGeometry } = require("../figma-cache/js/raw-derivatives");

function safeReadJson(absPath) {
  try {
    return JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(absPath, value) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs() {
  const { values } = parseCli(process.argv, {
    strings: ["raw", "geometry"],
    booleanFlags: [],
  });
  return {
    raw: (values.raw || "").trim(),
    geometry: (values.geometry || "").trim(),
  };
}

function main() {
  const args = parseArgs();
  const rawAbs = path.isAbsolute(args.raw) ? args.raw : path.join(process.cwd(), args.raw);
  const geoAbs = path.isAbsolute(args.geometry) ? args.geometry : path.join(process.cwd(), args.geometry);
  if (!args.raw || !args.geometry) {
    console.error(
      "Usage: node scripts/merge-figma-geometry-metrics.cjs --raw=<raw.json> --geometry=<figma-geometry-metrics.json>"
    );
    process.exit(2);
  }
  if (!fs.existsSync(rawAbs)) {
    console.error(`[merge-figma-geometry-metrics] raw not found: ${rawAbs}`);
    process.exit(2);
  }
  if (!fs.existsSync(geoAbs)) {
    console.error(`[merge-figma-geometry-metrics] geometry not found: ${geoAbs}`);
    process.exit(2);
  }

  const raw = safeReadJson(rawAbs);
  const geo = safeReadJson(geoAbs);
  if (!raw || typeof raw !== "object") {
    console.error(`[merge-figma-geometry-metrics] invalid raw: ${rawAbs}`);
    process.exit(2);
  }
  if (!geo || typeof geo !== "object" || !Array.isArray(geo.metrics)) {
    console.error(`[merge-figma-geometry-metrics] invalid geometry (need .metrics[]): ${geoAbs}`);
    process.exit(2);
  }

  mergeLayoutMetricsFromGeometry(raw, geo);
  writeJson(rawAbs, raw);
  console.log(
    `[merge-figma-geometry-metrics] ok merged=${geo.metrics.length} -> ${rawAbs}`
  );
}

main();
