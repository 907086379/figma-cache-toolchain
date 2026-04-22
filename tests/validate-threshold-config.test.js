const assert = require("assert");
const path = require("path");
const crypto = require("crypto");
const { validateMcpRawEvidence } = require("../figma-cache/js/validate-cli");

function normalizeFilePath(input) {
  return String(input || "").replace(/\\/g, "/");
}

function withEnv(overrides, fn) {
  const backup = {};
  Object.keys(overrides).forEach((key) => {
    backup[key] = process.env[key];
    const value = overrides[key];
    if (value === undefined || value === null) {
      delete process.env[key];
      return;
    }
    process.env[key] = String(value);
  });
  try {
    fn();
  } finally {
    Object.keys(overrides).forEach((key) => {
      if (backup[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = backup[key];
      }
    });
  }
}

function buildDeps(extra = {}) {
  const baseConfig = {
    validation: {
      mcpRawEvidence: {
        minDesignContextBytes: 1500,
        minDesignContextNodeRefs: 6,
        requireDesignContextAssets: true,
      },
    },
  };
  const projectConfig = extra.projectConfig || baseConfig;
  return {
    resolveMaybeAbsolutePath: (input) => input,
    safeReadJson: (input) => {
      if (typeof extra.safeReadJson === "function") {
        return extra.safeReadJson(input);
      }
      return null;
    },
    normalizeSlash: normalizeFilePath,
    path,
    fs: {
      existsSync: () => true,
      readFileSync: () => "",
      statSync: () => ({ size: 0 }),
      ...(extra.fs || {}),
    },
    normalizeCompletenessList: (list) => (Array.isArray(list) ? list : []),
    completenessToolRequirements: {
      layout: [["get_design_context"]],
      text: [["get_design_context"]],
      tokens: [["get_variable_defs"]],
    },
    loadProjectConfig: () => projectConfig,
  };
}

function makeManifestWithDesignContext(designContextFileName) {
  return {
    files: {
      get_design_context: designContextFileName,
      get_variable_defs: "mcp-raw-get-variable-defs.json",
    },
    fileHashes: {
      get_design_context: "__dynamic__",
      get_variable_defs: "__dynamic__",
    },
    fileSizes: {
      get_design_context: 0,
      get_variable_defs: 0,
    },
  };
}

function hashText(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function buildFsForFiles(fileMap) {
  const normalizedMap = {};
  Object.entries(fileMap).forEach(([filePath, value]) => {
    normalizedMap[normalizeFilePath(filePath)] = value;
  });
  return {
    existsSync: (filePath) =>
      Object.prototype.hasOwnProperty.call(normalizedMap, normalizeFilePath(filePath)),
    readFileSync: (filePath) => normalizedMap[normalizeFilePath(filePath)],
  };
}

(function testDefaultThresholdRejectsSmallDesignContext() {
  withEnv(
    {
      FIGMA_MCP_MIN_DESIGN_CONTEXT_BYTES: undefined,
      FIGMA_MCP_MIN_DESIGN_CONTEXT_NODE_REFS: undefined,
      FIGMA_MCP_REQUIRE_DESIGN_CONTEXT_ASSETS: undefined,
    },
    () => {
      const cacheKey = "abc#1:2";
      const manifestPath = normalizeFilePath(path.join("node", "mcp-raw", "mcp-raw-manifest.json"));
      const designContextPath = normalizeFilePath(
        path.join("node", "mcp-raw", "mcp-raw-get-design-context.txt"),
      );
      const variableDefsPath = normalizeFilePath(
        path.join("node", "mcp-raw", "mcp-raw-get-variable-defs.json"),
      );
      const designContext = '<div data-node-id="1:2"></div>';
      const variableDefs = "{}";
      const manifest = makeManifestWithDesignContext("mcp-raw-get-design-context.txt");
      manifest.fileHashes.get_design_context = hashText(designContext);
      manifest.fileHashes.get_variable_defs = hashText(variableDefs);
      manifest.fileSizes.get_design_context = Buffer.byteLength(designContext, "utf8");
      manifest.fileSizes.get_variable_defs = Buffer.byteLength(variableDefs, "utf8");

      const deps = buildDeps({
        safeReadJson: (filePath) =>
          normalizeFilePath(filePath) === manifestPath ? manifest : null,
        fs: buildFsForFiles({
          [designContextPath]: designContext,
          [variableDefsPath]: variableDefs,
        }),
        projectConfig: {},
      });

      const item = { paths: { meta: normalizeFilePath(path.join("node", "meta.json")) } };
      const errors = validateMcpRawEvidence(cacheKey, item, ["layout", "tokens"], {}, deps);
      assert.ok(errors.some((entry) => /原始文件疑似过小/.test(entry)));
    },
  );
})();

(function testPerCacheKeyOverrideAllowsSmallNode() {
  withEnv(
    {
      FIGMA_MCP_MIN_DESIGN_CONTEXT_BYTES: undefined,
      FIGMA_MCP_MIN_DESIGN_CONTEXT_NODE_REFS: undefined,
      FIGMA_MCP_REQUIRE_DESIGN_CONTEXT_ASSETS: undefined,
    },
    () => {
      const cacheKey = "abc#small-node";
      const manifestPath = normalizeFilePath(path.join("node", "mcp-raw", "mcp-raw-manifest.json"));
      const designContextPath = normalizeFilePath(
        path.join("node", "mcp-raw", "mcp-raw-get-design-context.txt"),
      );
      const variableDefsPath = normalizeFilePath(
        path.join("node", "mcp-raw", "mcp-raw-get-variable-defs.json"),
      );
      const designContext = '<div data-node-id="small-node"></div>';
      const variableDefs = "{}";
      const manifest = makeManifestWithDesignContext("mcp-raw-get-design-context.txt");
      manifest.fileHashes.get_design_context = hashText(designContext);
      manifest.fileHashes.get_variable_defs = hashText(variableDefs);
      manifest.fileSizes.get_design_context = Buffer.byteLength(designContext, "utf8");
      manifest.fileSizes.get_variable_defs = Buffer.byteLength(variableDefs, "utf8");

      const deps = buildDeps({
        safeReadJson: (filePath) =>
          normalizeFilePath(filePath) === manifestPath ? manifest : null,
        fs: buildFsForFiles({
          [designContextPath]: designContext,
          [variableDefsPath]: variableDefs,
        }),
        projectConfig: {
          validation: {
            mcpRawEvidence: {
              minDesignContextBytes: 1500,
              minDesignContextNodeRefs: 6,
              requireDesignContextAssets: true,
              perCacheKey: {
                [cacheKey]: {
                  minDesignContextBytes: 1,
                  minDesignContextNodeRefs: 1,
                  requireDesignContextAssets: false,
                },
              },
            },
          },
        },
      });

      const item = { paths: { meta: normalizeFilePath(path.join("node", "meta.json")) } };
      const errors = validateMcpRawEvidence(cacheKey, item, ["layout", "tokens"], {}, deps);
      assert.deepStrictEqual(errors, []);
    },
  );
})();

(function testEnvOverridesProjectDefaults() {
  withEnv(
    {
      FIGMA_MCP_MIN_DESIGN_CONTEXT_BYTES: "1",
      FIGMA_MCP_MIN_DESIGN_CONTEXT_NODE_REFS: "1",
      FIGMA_MCP_REQUIRE_DESIGN_CONTEXT_ASSETS: "0",
    },
    () => {
      const cacheKey = "abc#1:2";
      const manifestPath = normalizeFilePath(path.join("node", "mcp-raw", "mcp-raw-manifest.json"));
      const designContextPath = normalizeFilePath(
        path.join("node", "mcp-raw", "mcp-raw-get-design-context.txt"),
      );
      const variableDefsPath = normalizeFilePath(
        path.join("node", "mcp-raw", "mcp-raw-get-variable-defs.json"),
      );
      const designContext = '<div data-node-id="1:2"></div>';
      const variableDefs = "{}";
      const manifest = makeManifestWithDesignContext("mcp-raw-get-design-context.txt");
      manifest.fileHashes.get_design_context = hashText(designContext);
      manifest.fileHashes.get_variable_defs = hashText(variableDefs);
      manifest.fileSizes.get_design_context = Buffer.byteLength(designContext, "utf8");
      manifest.fileSizes.get_variable_defs = Buffer.byteLength(variableDefs, "utf8");

      const deps = buildDeps({
        safeReadJson: (filePath) =>
          normalizeFilePath(filePath) === manifestPath ? manifest : null,
        fs: buildFsForFiles({
          [designContextPath]: designContext,
          [variableDefsPath]: variableDefs,
        }),
        projectConfig: {
          validation: {
            mcpRawEvidence: {
              minDesignContextBytes: 1500,
              minDesignContextNodeRefs: 6,
              requireDesignContextAssets: true,
            },
          },
        },
      });

      const item = { paths: { meta: normalizeFilePath(path.join("node", "meta.json")) } };
      const errors = validateMcpRawEvidence(cacheKey, item, ["layout", "tokens"], {}, deps);
      assert.deepStrictEqual(errors, []);
    },
  );
})();

console.log("validate-threshold-config: ok");