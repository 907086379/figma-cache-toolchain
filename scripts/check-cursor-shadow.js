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

function readUtf8(absPath) {
  return fs.readFileSync(absPath, "utf8");
}

function normalize(relPath) {
  return relPath.replace(/\\/g, "/");
}

function main() {
  const errors = [];
  const checked = [];

  for (const [from, to] of pairs) {
    const src = path.join(BOOTSTRAP, from);
    const dst = path.join(ROOT, to);
    const fromNorm = normalize(`cursor-bootstrap/${from}`);
    const toNorm = normalize(to);

    if (!fs.existsSync(src)) {
      errors.push(`missing source: ${fromNorm}`);
      continue;
    }
    if (!fs.existsSync(dst)) {
      errors.push(`missing mirror: ${toNorm}`);
      continue;
    }

    const srcText = readUtf8(src);
    const dstText = readUtf8(dst);
    if (srcText !== dstText) {
      errors.push(`drift detected: ${fromNorm} != ${toNorm}`);
      continue;
    }

    checked.push({ from: fromNorm, to: toNorm });
  }

  if (errors.length) {
    process.stderr.write(
      `[cursor-shadow:check] failed\n- ${errors.join("\n- ")}\nRun: npm run cursor:shadow:sync\n`
    );
    process.exit(1);
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        checked,
      },
      null,
      2
    )}\n`
  );
}

main();
