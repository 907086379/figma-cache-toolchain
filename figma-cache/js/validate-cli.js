/* eslint-disable no-console */

function isTodoLike(value) {
  return /TODO/i.test(String(value || ""));
}

function getManifestFilesMap(cacheKey, item, errors, deps) {
  const { resolveMaybeAbsolutePath, safeReadJson, normalizeSlash, path, fs } = deps;
  if (!item || !item.paths || !item.paths.meta) {
    errors.push(`${cacheKey}: source=figma-mcp 但缺少 paths.meta，无法定位 mcp-raw`);
    return null;
  }
  const metaAbs = resolveMaybeAbsolutePath(item.paths.meta);
  const nodeDir = path.dirname(metaAbs);
  const mcpRawDir = path.join(nodeDir, "mcp-raw");
  const manifestAbs = path.join(mcpRawDir, "mcp-raw-manifest.json");
  const manifest = safeReadJson(manifestAbs);
  if (!manifest || typeof manifest !== "object") {
    errors.push(`${cacheKey}: source=figma-mcp 但缺少 mcp-raw/mcp-raw-manifest.json`);
    return null;
  }
  if (!manifest.files || typeof manifest.files !== "object") {
    errors.push(`${cacheKey}: mcp-raw-manifest.json 缺少 files 映射`);
    return null;
  }
  Object.entries(manifest.files).forEach(([toolName, fileName]) => {
    if (!fileName) {
      errors.push(`${cacheKey}: mcp-raw-manifest.json 中 ${toolName} 未关联文件`);
      return;
    }
    const fileAbs = path.join(mcpRawDir, String(fileName));
    if (!fs.existsSync(fileAbs)) {
      errors.push(`${cacheKey}: 缺少 MCP 原始文件 ${normalizeSlash(fileAbs)}`);
    }
  });
  return manifest.files;
}

function collectMissingToolEvidence(completeness, filesMap, normalizeCompletenessList, toolRequirements) {
  const missing = [];
  normalizeCompletenessList(completeness).forEach((dimension) => {
    const groups = toolRequirements[dimension];
    if (!Array.isArray(groups) || !groups.length) {
      return;
    }
    groups.forEach((alternatives) => {
      const hit = alternatives.some((toolName) =>
        Object.prototype.hasOwnProperty.call(filesMap, toolName)
      );
      if (!hit) {
        missing.push({
          dimension,
          alternatives,
        });
      }
    });
  });
  return missing;
}

function validateMcpRawEvidence(cacheKey, item, completeness, options, deps) {
  const errors = [];
  if (options && options.allowSkeletonWithFigmaMcp) {
    return errors;
  }

  const filesMap = getManifestFilesMap(cacheKey, item, errors, deps);
  if (!filesMap) {
    return errors;
  }

  const missing = collectMissingToolEvidence(
    completeness,
    filesMap,
    deps.normalizeCompletenessList,
    deps.completenessToolRequirements
  );
  missing.forEach(({ dimension, alternatives }) => {
    errors.push(
      `${cacheKey}: completeness=${dimension} 缺少 MCP 原始证据（需包含 ${alternatives.join(" 或 ")}）`
    );
  });
  return errors;
}

function validateCompletenessEvidence(cacheKey, item, deps) {
  const errors = [];
  const covered = deps.normalizeCompletenessList(item.completeness);
  if (!covered.length) {
    return errors;
  }
  if (!item.paths || !item.paths.raw) {
    errors.push(`${cacheKey}: completeness 非空但缺少 paths.raw`);
    return errors;
  }

  const rawAbs = deps.resolveMaybeAbsolutePath(item.paths.raw);
  const raw = deps.safeReadJson(rawAbs);
  if (!raw || typeof raw !== "object") {
    errors.push(`${cacheKey}: raw.json 不可读，无法校验 completeness 证据`);
    return errors;
  }

  const coverageSummary =
    raw.coverageSummary && typeof raw.coverageSummary === "object"
      ? raw.coverageSummary
      : null;
  const evidence =
    coverageSummary && coverageSummary.evidence && typeof coverageSummary.evidence === "object"
      ? coverageSummary.evidence
      : null;
  if (!evidence) {
    errors.push(`${cacheKey}: raw.json 缺少 coverageSummary.evidence`);
    return errors;
  }

  covered.forEach((dimension) => {
    const list = Array.isArray(evidence[dimension])
      ? evidence[dimension].filter((x) => typeof x === "string" && String(x).trim())
      : [];
    if (!list.length) {
      errors.push(`${cacheKey}: completeness=${dimension} 但缺少 evidence`);
    }
  });

  if (item.source === "figma-mcp") {
    ["interactions", "states", "accessibility"].forEach((dimension) => {
      if (!covered.includes(dimension)) {
        return;
      }
      const section = raw[dimension] && typeof raw[dimension] === "object" ? raw[dimension] : null;
      const notes = section ? String(section.notes || "") : "";
      if (!notes || isTodoLike(notes)) {
        errors.push(`${cacheKey}: ${dimension} 仍为占位内容（TODO），请补充可执行证据`);
      }
    });
  }

  return errors;
}

function validateIndex(index, deps) {
  const errors = [];
  const normalized = deps.normalizeIndexShape(index);
  const keys = Object.keys(normalized.items || {});

  keys.forEach((cacheKey) => {
    const item = normalized.items[cacheKey];
    const required = [
      "fileKey",
      "scope",
      "url",
      "originalUrls",
      "normalizationVersion",
      "paths",
      "syncedAt",
      "completeness",
    ];

    required.forEach((field) => {
      if (item[field] === undefined || item[field] === null) {
        errors.push(`${cacheKey}: 缺少字段 ${field}`);
      }
    });

    if (item.scope === "node" && !item.nodeId) {
      errors.push(`${cacheKey}: node 作用域必须包含 nodeId`);
    }

    errors.push(...validateCompletenessEvidence(cacheKey, item, deps));
    if (item.source === "figma-mcp") {
      errors.push(
        ...validateMcpRawEvidence(cacheKey, item, item.completeness, {
          allowSkeletonWithFigmaMcp: false,
        }, deps)
      );
    }
  });

  const flowKeys = Object.keys(normalized.flows || {});
  flowKeys.forEach((flowId) => {
    const flow = normalized.flows[flowId];
    if (!flow || typeof flow !== "object") {
      errors.push(`flow ${flowId}: 非法结构`);
      return;
    }
    if (!flow.id || flow.id !== flowId) {
      errors.push(`flow ${flowId}: id 字段缺失或不一致`);
    }
    if (!Array.isArray(flow.nodes)) {
      errors.push(`flow ${flowId}: nodes 必须是数组`);
    }
    if (!Array.isArray(flow.edges)) {
      errors.push(`flow ${flowId}: edges 必须是数组`);
    }

    if (Array.isArray(flow.edges)) {
      flow.edges.forEach((edge, idx) => {
        if (!edge || typeof edge !== "object") {
          errors.push(`flow ${flowId}: edge[${idx}] 非法`);
          return;
        }
        if (!edge.from || !edge.to) {
          errors.push(`flow ${flowId}: edge[${idx}] 缺少 from/to`);
        }
        if (!edge.type) {
          errors.push(`flow ${flowId}: edge[${idx}] 缺少 type`);
        }
        if (edge.from && !normalized.items[edge.from]) {
          errors.push(`flow ${flowId}: edge[${idx}] from 不存在于 items: ${edge.from}`);
        }
        if (edge.to && !normalized.items[edge.to]) {
          errors.push(`flow ${flowId}: edge[${idx}] to 不存在于 items: ${edge.to}`);
        }
      });
    }

    if (Array.isArray(flow.nodes)) {
      flow.nodes.forEach((nodeCacheKey) => {
        if (!normalized.items[nodeCacheKey]) {
          errors.push(`flow ${flowId}: nodes 引用不存在于 items: ${nodeCacheKey}`);
        }
      });
    }
  });

  return errors;
}

module.exports = {
  validateMcpRawEvidence,
  validateIndex,
};