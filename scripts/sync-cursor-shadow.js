#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BOOTSTRAP = path.join(ROOT, "cursor-bootstrap");

const pairs = [
  ["rules/00-output-token-budget.mdc", ".cursor/rules/00-output-token-budget.mdc"],
  ["rules/01-figma-cache-core.mdc", ".cursor/rules/01-figma-cache-core.mdc"],
  ["rules/02-figma-stack-adapter.mdc", ".cursor/rules/02-figma-stack-adapter.mdc"],
  ["rules/figma-local-cache-first.mdc", ".cursor/rules/figma-local-cache-first.mdc"],
  ["skills/figma-mcp-local-cache/SKILL.md", ".cursor/skills/figma-mcp-local-cache/SKILL.md"],
];

function copyPair(relFrom, relTo) {
  const src = path.join(BOOTSTRAP, relFrom);
  const dst = path.join(ROOT, relTo);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source template: ${src}`);
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  return { from: relFrom.replace(/\\/g, "/"), to: relTo.replace(/\\/g, "/") };
}

function main() {
  if (!fs.existsSync(BOOTSTRAP)) {
    throw new Error(`Missing cursor-bootstrap directory: ${BOOTSTRAP}`);
  }

  const copied = pairs.map(([from, to]) => copyPair(from, to));
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        sourceOfTruth: "cursor-bootstrap",
        copied,
      },
      null,
      2
    )}\n`
  );
}

main();
