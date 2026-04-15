"use strict";

const { execSync } = require("child_process");
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.join(__dirname, "..");
const bin = path.join(root, "bin", "figma-cache.js");

const TEST_URL = "https://www.figma.com/file/abcABCd0123456789vWxyZ/x?node-id=1-2";
const FILE_KEY = "abcABCd0123456789vWxyZ";
const NODE_ID = "1:2";
const SAFE_NODE_ID = "1-2";
const CACHE_KEY = `${FILE_KEY}#${NODE_ID}`;

function run(args, opts) {
  const next = opts || {};
  return execSync(`node "${bin}" ${args}`, {
    cwd: next.cwd || root,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...next,
  });
}

function runWithEnv(args, extraEnv) {
  return run(args, {
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
}

function runInDir(args, cwd, extraEnv) {
  return run(args, {
    cwd,
    env: {
      ...process.env,
      ...(extraEnv || {}),
    },
  });
}

function expectThrow(fn, message) {
  let error = null;
  try {
    fn();
  } catch (e) {
    error = e;
  }
  assert.ok(error, message || "expected command to throw");
  return error;
}

function createTempEnv(prefix) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const cacheDir = path.join(tempRoot, "figma-cache");
  const env = {
    FIGMA_CACHE_DIR: cacheDir,
    FIGMA_CACHE_INDEX_FILE: "index.json",
  };
  runWithEnv("init", env);
  return { tempRoot, cacheDir, env };
}

function ensureMcpEvidence(cacheDir, files) {
  const nodeDir = path.join(cacheDir, "files", FILE_KEY, "nodes", SAFE_NODE_ID);
  const mcpRawDir = path.join(nodeDir, "mcp-raw");
  fs.mkdirSync(mcpRawDir, { recursive: true });

  const filesMap = files || {
    get_design_context: "mcp-raw-get-design-context.txt",
    get_metadata: "mcp-raw-get-metadata.xml",
    get_variable_defs: "mcp-raw-get-variable-defs.json",
  };

  fs.writeFileSync(
    path.join(mcpRawDir, "mcp-raw-manifest.json"),
    JSON.stringify(
      {
        mcpServer: "plugin-figma-figma",
        fileKey: FILE_KEY,
        nodeId: NODE_ID,
        files: filesMap,
      },
      null,
      2
    ),
    "utf8"
  );

  Object.entries(filesMap).forEach(([tool, fileName]) => {
    let content = `mock evidence: ${tool}`;
    if (tool === "get_metadata") {
      content = "<instance/>";
    } else if (tool === "get_variable_defs") {
      content = "{}";
    }
    fs.writeFileSync(path.join(mcpRawDir, fileName), content, "utf8");
  });

  return { nodeDir, mcpRawDir };
}

// normalize: stable cacheKey shape
const normalized = JSON.parse(run(`normalize "${TEST_URL}"`).trim());
assert.strictEqual(normalized.fileKey, FILE_KEY);
assert.strictEqual(normalized.nodeId, NODE_ID);
assert.ok(normalized.cacheKey.includes(NODE_ID));

// config: JSON shape
const cfg = JSON.parse(run("config").trim());
assert.strictEqual(typeof cfg.normalizationVersion, "number");
assert.ok(cfg.cacheDir && cfg.indexPath);

// unknown subcommand -> non-zero exit
let exitCode = 0;
try {
  run("this-command-does-not-exist-figma-cache");
} catch (e) {
  exitCode = e.status;
}
assert.ok(exitCode > 0, "unknown command should exit non-zero");

// negative: source=figma-mcp upsert must fail without MCP evidence
{
  const { env } = createTempEnv("figma-cache-smoke-upsert-missing-");
  const err = expectThrow(
    () => runWithEnv(`upsert "${TEST_URL}" --source=figma-mcp --completeness=layout,text,tokens`, env),
    "upsert should fail when MCP raw evidence is missing"
  );
  assert.strictEqual(err.status, 2, "upsert should fail with exit code 2");
}

// negative: source=figma-mcp ensure must fail without MCP evidence
{
  const { env } = createTempEnv("figma-cache-smoke-ensure-missing-");
  const err = expectThrow(
    () => runWithEnv(`ensure "${TEST_URL}" --source=figma-mcp --completeness=layout,text,tokens`, env),
    "ensure should fail when MCP raw evidence is missing"
  );
  assert.strictEqual(err.status, 2, "ensure should fail with exit code 2");
}

// positive: source=figma-mcp upsert succeeds when evidence is complete
{
  const { cacheDir, env } = createTempEnv("figma-cache-smoke-upsert-ok-");
  ensureMcpEvidence(cacheDir);
  const result = JSON.parse(
    runWithEnv(
      `upsert "${TEST_URL}" --source=figma-mcp --completeness=layout,text,tokens`,
      env
    ).trim()
  );
  assert.strictEqual(result.cacheKey, CACHE_KEY);
}

// skeleton bypass: allow-skeleton allows write, but validate must still block missing evidence
{
  const { env } = createTempEnv("figma-cache-smoke-skeleton-bypass-");
  const ensured = JSON.parse(
    runWithEnv(
      `ensure "${TEST_URL}" --source=figma-mcp --completeness=layout,text,tokens,interactions,states,accessibility --allow-skeleton-with-figma-mcp`,
      env
    ).trim()
  );
  assert.strictEqual(ensured.cacheKey, CACHE_KEY);
  assert.strictEqual(ensured.ensured, true);

  const err = expectThrow(
    () => runWithEnv("validate", env),
    "validate should fail when skeleton bypass item lacks MCP evidence"
  );
  assert.strictEqual(err.status, 2, "validate should fail with exit code 2");
}

// strict validate: completeness dimensions require non-empty coverageSummary.evidence
{
  const { cacheDir, env } = createTempEnv("figma-cache-smoke-validate-evidence-");
  const { nodeDir } = ensureMcpEvidence(cacheDir);

  runWithEnv(
    `upsert "${TEST_URL}" --source=figma-mcp --completeness=layout,text,tokens,interactions`,
    env
  );
  runWithEnv(
    `ensure "${TEST_URL}" --source=figma-mcp --completeness=layout,text,tokens,interactions`,
    env
  );

  const rawPath = path.join(nodeDir, "raw.json");
  const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));
  raw.coverageSummary = raw.coverageSummary || {};
  raw.coverageSummary.evidence = raw.coverageSummary.evidence || {};
  raw.coverageSummary.evidence.interactions = [];
  fs.writeFileSync(rawPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");

  const err = expectThrow(
    () => runWithEnv("validate", env),
    "validate should fail when completeness evidence is empty"
  );
  assert.strictEqual(err.status, 2, "validate should fail with exit code 2");
}

// strict validate: TODO placeholders are forbidden for figma-mcp interactions/states/accessibility
{
  const { cacheDir, env } = createTempEnv("figma-cache-smoke-validate-todo-");
  ensureMcpEvidence(cacheDir);

  runWithEnv(
    `upsert "${TEST_URL}" --source=figma-mcp --completeness=layout,text,tokens,interactions,states,accessibility`,
    env
  );
  runWithEnv(
    `ensure "${TEST_URL}" --source=figma-mcp --completeness=layout,text,tokens,interactions,states,accessibility`,
    env
  );

  const err = expectThrow(
    () => runWithEnv("validate", env),
    "validate should fail for TODO placeholders"
  );
  assert.strictEqual(err.status, 2, "validate should fail with exit code 2");
}


// cursor init: should ensure figma-cache.config.js and cleanup safe legacy example
{
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "figma-cache-smoke-cursor-init-"));
  const cacheDir = path.join(tempRoot, "figma-cache");
  const env = {
    FIGMA_CACHE_DIR: cacheDir,
    FIGMA_CACHE_INDEX_FILE: "index.json",
  };

  const legacyExamplePath = path.join(tempRoot, "figma-cache.config.example.js");
  fs.writeFileSync(
    legacyExamplePath,
    "module.exports = { hooks: { postEnsure() {} } };\n",
    "utf8"
  );

  const initOutput = runInDir("cursor init", tempRoot, env);
  const firstJson = initOutput.split(/\r?\n\r?\n/)[0];
  const initResult = JSON.parse(firstJson);
  assert.strictEqual(initResult.ok, true);

  const configPath = path.join(tempRoot, "figma-cache.config.js");
  assert.ok(fs.existsSync(configPath), "cursor init should create figma-cache.config.js");
  assert.ok(!fs.existsSync(legacyExamplePath), "cursor init should cleanup identical legacy example");

  const configBody = fs.readFileSync(configPath, "utf8");
  assert.ok(configBody.includes("module.exports"), "generated config should be valid JS module");
}

console.log("smoke: ok");
