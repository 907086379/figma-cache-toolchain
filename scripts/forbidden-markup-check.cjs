#!/usr/bin/env node
"use strict";

/**
 * Toolchain-provided forbidden markup check.
 * Projects can call this script directly from node_modules to hard-fail on disallowed UI patterns.
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

const DEFAULT_CONSTRAINTS_PATH = path.join(ROOT, "ui-hard-constraints.json");
const DEFAULT_POLICY_PATH = path.join(ROOT, "ui-policy.json");
const DEFAULT_PLATFORM = "web-vue";

function parseArgs(argv) {
  const out = {
    batch: path.join(ROOT, "figma-e2e-batch.json"),
    files: [],
    constraints: DEFAULT_CONSTRAINTS_PATH,
    policy: DEFAULT_POLICY_PATH,
    platform: DEFAULT_PLATFORM,
    adapter: "",
  };
  argv.slice(2).forEach((arg) => {
    if (arg.startsWith("--batch=")) {
      out.batch = arg.split("=").slice(1).join("=").trim();
      return;
    }
    if (arg.startsWith("--file=")) {
      out.files.push(arg.split("=").slice(1).join("=").trim());
      return;
    }
    if (arg.startsWith("--constraints=")) {
      out.constraints = arg.split("=").slice(1).join("=").trim();
      return;
    }
    if (arg.startsWith("--policy=")) {
      out.policy = arg.split("=").slice(1).join("=").trim();
      return;
    }
    if (arg.startsWith("--platform=")) {
      out.platform = arg.split("=").slice(1).join("=").trim();
      return;
    }
    if (arg.startsWith("--adapter=")) {
      out.adapter = arg.split("=").slice(1).join("=").trim();
      return;
    }
  });
  return out;
}

function readJsonIfExists(absPath) {
  if (!absPath) return null;
  if (!fs.existsSync(absPath)) return null;
  return JSON.parse(fs.readFileSync(absPath, "utf8"));
}

function resolveAdapterPath(platform, adapterArg) {
  if (adapterArg) return adapterArg;
  const file = `ui-adapter.${platform}.json`;
  return path.join(ROOT, file);
}

function normalizePrimitiveDetectors(raw) {
  if (!raw)
    return { forbiddenTags: [], forbiddenAttrPrefixes: [], forbiddenAttrNames: [], forbiddenPatterns: [] };
  const forbiddenTags = Array.isArray(raw.forbiddenTags) ? raw.forbiddenTags.map(String) : [];
  const forbiddenAttrPrefixes = Array.isArray(raw.forbiddenAttrPrefixes)
    ? raw.forbiddenAttrPrefixes.map(String)
    : [];
  const forbiddenAttrNames = Array.isArray(raw.forbiddenAttrNames) ? raw.forbiddenAttrNames.map(String) : [];
  const forbiddenPatterns = Array.isArray(raw.forbiddenPatterns) ? raw.forbiddenPatterns : [];
  return { forbiddenTags, forbiddenAttrPrefixes, forbiddenAttrNames, forbiddenPatterns };
}

function compileConstraintsFromPolicy(policyRaw, adapterRaw) {
  const policy = policyRaw || {};
  const forbiddenPrimitives = Array.isArray(policy.forbiddenPrimitives)
    ? policy.forbiddenPrimitives.map(String)
    : [];
  const primitives = (adapterRaw && adapterRaw.primitives) || {};

  const acc = {
    forbiddenTags: [],
    forbiddenAttrPrefixes: [],
    forbiddenAttrNames: [],
    forbiddenPatterns: [],
  };

  forbiddenPrimitives.forEach((primitive) => {
    const detectors = normalizePrimitiveDetectors(primitives[primitive]);
    acc.forbiddenTags.push(...detectors.forbiddenTags);
    acc.forbiddenAttrPrefixes.push(...detectors.forbiddenAttrPrefixes);
    acc.forbiddenAttrNames.push(...detectors.forbiddenAttrNames);
    acc.forbiddenPatterns.push(...detectors.forbiddenPatterns);
  });

  acc.forbiddenTags = Array.from(new Set(acc.forbiddenTags));
  acc.forbiddenAttrPrefixes = Array.from(new Set(acc.forbiddenAttrPrefixes));
  acc.forbiddenAttrNames = Array.from(new Set(acc.forbiddenAttrNames));
  acc.forbiddenPatterns = acc.forbiddenPatterns.filter(Boolean);

  return acc;
}

function normalizeConstraints(raw) {
  const g = (raw && raw.global) || raw || {};
  const forbiddenTags = Array.isArray(g.forbiddenTags) ? g.forbiddenTags.map(String) : [];
  const forbiddenAttrPrefixes = Array.isArray(g.forbiddenAttrPrefixes)
    ? g.forbiddenAttrPrefixes.map(String)
    : [];
  const forbiddenAttrNames = Array.isArray(g.forbiddenAttrNames) ? g.forbiddenAttrNames.map(String) : [];
  const forbiddenPatterns = Array.isArray(g.forbiddenPatterns) ? g.forbiddenPatterns : [];

  return {
    forbiddenTags,
    forbiddenAttrPrefixes,
    forbiddenAttrNames,
    forbiddenPatterns: forbiddenPatterns
      .map((x) => ({
        id: String(x && x.id ? x.id : "pattern"),
        re: new RegExp(String(x && x.pattern ? x.pattern : ""), "i"),
      }))
      .filter((x) => x.re && String(x.re) !== String(/(?:)/i)),
  };
}

function mergeConstraints(base, override) {
  if (!override) return base;
  const next = { ...base };
  if (Array.isArray(override.forbiddenTags)) next.forbiddenTags = override.forbiddenTags.map(String);
  if (Array.isArray(override.forbiddenAttrPrefixes))
    next.forbiddenAttrPrefixes = override.forbiddenAttrPrefixes.map(String);
  if (Array.isArray(override.forbiddenAttrNames)) next.forbiddenAttrNames = override.forbiddenAttrNames.map(String);
  if (Array.isArray(override.forbiddenPatterns)) {
    next.forbiddenPatterns = override.forbiddenPatterns
      .map((x) => ({
        id: String(x && x.id ? x.id : "pattern"),
        re: new RegExp(String(x && x.pattern ? x.pattern : ""), "i"),
      }))
      .filter((x) => x.re && String(x.re) !== String(/(?:)/i));
  }
  return next;
}

function readBatchTargets(batchPath) {
  const abs = path.isAbsolute(batchPath) ? batchPath : path.join(ROOT, batchPath);
  if (!fs.existsSync(abs)) throw new Error(`batch file missing: ${abs}`);
  const payload = JSON.parse(fs.readFileSync(abs, "utf8"));
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("batch file must contain at least one item");
  }
  return payload.map((item, idx) => {
    const target = String(item && item.target ? item.target : "").trim();
    if (!target) throw new Error(`case[${idx}] missing target`);
    const absTarget = path.isAbsolute(target) ? path.normalize(target) : path.join(ROOT, target);
    const constraintsOverride = item && item.constraints ? item.constraints : null;
    const policyOverride = item && item.policy ? item.policy : null;
    return { absTarget, constraintsOverride, policyOverride };
  });
}

function applyPolicyOverride(basePolicy, policyOverride) {
  if (!policyOverride) return basePolicy;
  const next = { ...(basePolicy || {}) };
  const baseForbidden = Array.isArray(next.forbiddenPrimitives) ? next.forbiddenPrimitives.map(String) : [];
  const addForbidden = Array.isArray(policyOverride.forbiddenPrimitives)
    ? policyOverride.forbiddenPrimitives.map(String)
    : [];
  const allow = Array.isArray(policyOverride.allowPrimitives) ? policyOverride.allowPrimitives.map(String) : [];

  const merged = Array.from(new Set([...baseForbidden, ...addForbidden]));
  next.forbiddenPrimitives = merged.filter((x) => !allow.includes(x));
  return next;
}

function scanFile(absPath, constraints) {
  const content = fs.readFileSync(absPath, "utf8");
  const violations = [];

  constraints.forbiddenTags.forEach((tag) => {
    const re = new RegExp(`<\\s*${tag}(\\s|>|/)`, "gi");
    if (re.test(content)) violations.push(`forbidden tag: <${tag}>`);
  });

  constraints.forbiddenAttrPrefixes.forEach((prefix) => {
    const re = new RegExp(`\\s${prefix}[a-z0-9_-]+\\s*=`, "gi");
    if (re.test(content)) violations.push(`forbidden attr prefix: ${prefix}*`);
  });

  constraints.forbiddenAttrNames.forEach((name) => {
    const re = new RegExp(`\\s${name}\\s*=`, "gi");
    if (re.test(content)) violations.push(`forbidden attr: ${name}`);
  });

  constraints.forbiddenPatterns.forEach((item) => {
    if (item.re.test(content)) violations.push(`forbidden pattern: ${item.id}`);
  });

  // Require cursor-pointer on interactive elements (Vue template heuristic).
  const clickLike =
    /<([a-zA-Z][\w-]*)([^>]*)(@click|@pointerdown|@mousedown|@mouseup)\s*=\s*["'][^"']+["']([^>]*)>/g;
  let match = null;
  while ((match = clickLike.exec(content))) {
    const tag = String(match[1] || "");
    const attrs = `${match[2] || ""}${match[4] || ""}`;
    if (!/cursor-pointer/.test(attrs)) {
      violations.push(`missing cursor-pointer on interactive <${tag}>`);
    }
  }

  // Avoid icon distortion: forbid icon-like img stretching combo.
  const imgSizeFullIconLike =
    /<img[^>]*class\s*=\s*["'][^"']*\bmax-w-none\b[^"']*\binset-0\b[^"']*\bsize-full\b[^"']*["'][^>]*>/gi;
  if (imgSizeFullIconLike.test(content)) {
    violations.push("forbidden icon img classes: max-w-none + inset-0 + size-full (causes icon stretching)");
  }

  return violations;
}

function main() {
  const args = parseArgs(process.argv);

  const policyPath = path.isAbsolute(args.policy) ? args.policy : path.join(ROOT, args.policy);
  const adapterPathRaw = resolveAdapterPath(args.platform, args.adapter);
  const adapterPath = path.isAbsolute(adapterPathRaw) ? adapterPathRaw : path.join(ROOT, adapterPathRaw);

  const policyRaw = readJsonIfExists(policyPath);
  const adapterRaw = readJsonIfExists(adapterPath);
  const canUsePolicy = Boolean(policyRaw && adapterRaw);

  const constraintsPath = path.isAbsolute(args.constraints) ? args.constraints : path.join(ROOT, args.constraints);
  const legacyConstraintsRaw = readJsonIfExists(constraintsPath) || {
    global: {
      forbiddenTags: ["button", "p", "ul", "li"],
      forbiddenAttrPrefixes: ["aria-"],
      forbiddenAttrNames: ["role", "tabindex"],
      forbiddenPatterns: [
        { id: "custom scrollbar wrapper: scrollbar-hint", pattern: "\\bscrollbar-hint\\b" },
        { id: "custom scrollbar wrapper: hide-native-scrollbar", pattern: "\\bhide-native-scrollbar\\b" },
      ],
    },
  };

  const globalConstraints = canUsePolicy
    ? normalizeConstraints(compileConstraintsFromPolicy(policyRaw, adapterRaw))
    : normalizeConstraints(legacyConstraintsRaw);

  const explicitFiles = (args.files || [])
    .map((p) => (path.isAbsolute(p) ? p : path.join(ROOT, p)))
    .filter(Boolean);

  const batchItems = explicitFiles.length
    ? explicitFiles.map((absTarget) => ({ absTarget, constraintsOverride: null, policyOverride: null }))
    : readBatchTargets(args.batch);

  const missing = batchItems.map((x) => x.absTarget).filter((p) => !fs.existsSync(p));
  if (missing.length) {
    console.error("[forbidden-markup-check] missing target files:");
    missing.forEach((p) => console.error(`- ${p}`));
    process.exit(2);
  }

  const allViolations = [];
  batchItems.forEach((item) => {
    const compiledForCase = canUsePolicy
      ? normalizeConstraints(compileConstraintsFromPolicy(applyPolicyOverride(policyRaw, item.policyOverride), adapterRaw))
      : globalConstraints;
    const effective = mergeConstraints(compiledForCase, item.constraintsOverride);
    const violations = scanFile(item.absTarget, effective);
    if (violations.length) {
      allViolations.push({ file: item.absTarget, violations });
    }
  });

  if (allViolations.length) {
    console.error("[forbidden-markup-check] FAILED. Found forbidden markup.");
    console.error("Rules:");
    console.error(`- tags: ${globalConstraints.forbiddenTags.map((t) => `<${t}>`).join(", ")}`);
    console.error(
      `- attrs: ${globalConstraints.forbiddenAttrNames.join(", ")}, ${globalConstraints.forbiddenAttrPrefixes.join("")}*`
    );
    console.error("");
    allViolations.forEach((item) => {
      console.error(item.file);
      item.violations.forEach((v) => console.error(`  - ${v}`));
    });
    process.exit(2);
  }

  console.log("[forbidden-markup-check] ok");
}

main();

