#!/usr/bin/env node
/* eslint-disable no-console */
"use strict";

const fs = require("fs");
const path = require("path");
const { buildContractCheckReport } = require("../figma-cache/js/contract-check-cli");

const ROOT = process.cwd();
const CACHE_DIR_INPUT = process.env.FIGMA_CACHE_DIR || "figma-cache";
const INDEX_FILE_NAME = process.env.FIGMA_CACHE_INDEX_FILE || "index.json";
const CONTRACT_REL =
  process.env.FIGMA_CACHE_ADAPTER_CONTRACT ||
  "figma-cache/adapters/ui-adapter.contract.json";

function normalizeSlash(input) {
  return String(input || "").replace(/\\/g, "/");
}

function resolveMaybeAbsolutePath(input) {
  if (!input) {
    return "";
  }
  return path.isAbsolute(input) ? path.normalize(input) : path.join(ROOT, input);
}

function readJsonOrNull(absPath) {
  try {
    return JSON.parse(fs.readFileSync(absPath, "utf8"));
  } catch {
    return null;
  }
}

function readTextOrEmpty(absPath) {
  try {
    return fs.readFileSync(absPath, "utf8");
  } catch {
    return "";
  }
}

function parseArgs(argv) {
  const options = {
    cacheKey: "",
    warnUnmappedTokens: false,
    warnUnmappedStates: false,
  };

  argv.forEach((arg) => {
    if (arg.startsWith("--cacheKey=")) {
      options.cacheKey = arg.split("=").slice(1).join("=").trim();
      return;
    }
    if (arg === "--warn-unmapped-tokens") {
      options.warnUnmappedTokens = true;
      return;
    }
    if (arg === "--warn-unmapped-states") {
      options.warnUnmappedStates = true;
    }
  });

  return options;
}

function run() {
  const options = parseArgs(process.argv.slice(2));

  const cacheDir = resolveMaybeAbsolutePath(CACHE_DIR_INPUT);
  const indexPath = path.isAbsolute(INDEX_FILE_NAME)
    ? INDEX_FILE_NAME
    : path.join(cacheDir, INDEX_FILE_NAME);
  const contractPath = resolveMaybeAbsolutePath(CONTRACT_REL);

  const report = buildContractCheckReport(
    {
      ...options,
      contractPath,
    },
    {
      index: readJsonOrNull(indexPath),
      contract: readJsonOrNull(contractPath),
      readJsonOrNull,
      readTextOrEmpty,
      resolveMaybeAbsolutePath,
      normalizeSlash,
    }
  );

  if (!report.ok) {
    console.error("contract-check failed:");
    report.hardErrors.forEach((error) => console.error(`- ${error}`));
    if (report.warnings.length) {
      console.error("\nWarnings:");
      report.warnings.forEach((warning) => console.error(`- ${warning}`));
    }
    process.exit(2);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        contract: normalizeSlash(contractPath),
        checkedItems: report.checkedItems,
        checkedCacheKeys: report.checkedCacheKeys,
        warnings: report.warnings,
      },
      null,
      2
    )
  );
}

run();