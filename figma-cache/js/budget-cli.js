/* eslint-disable no-console */

function parsePositiveIntOr(input, fallback) {
  const n = Number(input);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function buildBudgetReport(options, deps) {
  const index = deps.normalizeIndexShape(deps.readIndex());
  const items = index.items || {};
  const keys = Object.keys(items);

  const filteredKeys = keys.filter((cacheKey) => {
    if (options.cacheKey && cacheKey !== options.cacheKey) {
      return false;
    }
    if (options.mcpOnly) {
      const item = items[cacheKey];
      return item && item.source === "figma-mcp";
    }
    return true;
  });

  const entries = filteredKeys.map((cacheKey) => {
    const item = items[cacheKey];
    const metaAbs = deps.resolveMaybeAbsolutePath(item.paths.meta);
    const nodeDir = deps.path.dirname(metaAbs);
    const mcpRawDir = deps.path.join(nodeDir, "mcp-raw");
    const manifestAbs = deps.path.join(mcpRawDir, "mcp-raw-manifest.json");
    const manifest = deps.safeReadJson(manifestAbs);
    const filesMap = manifest && manifest.files && typeof manifest.files === "object" ? manifest.files : {};
    const fileEntries = Object.entries(filesMap);

    const mcpRawBytes = fileEntries.reduce((acc, [, fileName]) => {
      const abs = deps.path.join(mcpRawDir, String(fileName));
      return acc + deps.safeFileSize(abs);
    }, 0);

    const mcpRawFilesCount = fileEntries.length;
    const toolCalls =
      manifest && manifest.toolCalls && typeof manifest.toolCalls === "object"
        ? manifest.toolCalls
        : {};
    const toolCallCount = Object.values(toolCalls).reduce((acc, v) => {
      const count = v && typeof v === "object" ? Number(v.count) : 0;
      return acc + (Number.isFinite(count) ? count : 0);
    }, 0);

    const designContextFile =
      filesMap && Object.prototype.hasOwnProperty.call(filesMap, "get_design_context")
        ? String(filesMap.get_design_context)
        : "";
    const designContextChars = designContextFile
      ? deps.safeFileSize(deps.path.join(mcpRawDir, designContextFile))
      : 0;

    return {
      cacheKey,
      source: item.source || "manual",
      completeness: Array.isArray(item.completeness) ? item.completeness : [],
      hasMcpRawManifest: !!manifest,
      mcpRawFilesCount,
      mcpRawBytes,
      tokenProxyBytes: designContextChars,
      tokenProxyChars: designContextChars,
      toolCallCount,
      toolCalls,
    };
  });

  entries.sort((a, b) => b.mcpRawBytes - a.mcpRawBytes);
  const limit = parsePositiveIntOr(options.limit, entries.length);
  const limitedEntries = entries.slice(0, limit);
  const totals = limitedEntries.reduce(
    (acc, e) => {
      acc.nodes += 1;
      acc.nodesWithMcpRaw += e.hasMcpRawManifest ? 1 : 0;
      acc.mcpRawBytes += e.mcpRawBytes;
      acc.tokenProxyBytes += e.tokenProxyBytes;
      acc.toolCallCount += e.toolCallCount;
      return acc;
    },
    {
      nodes: 0,
      nodesWithMcpRaw: 0,
      mcpRawBytes: 0,
      tokenProxyBytes: 0,
      toolCallCount: 0,
    }
  );

  totals.tokenProxyChars = totals.tokenProxyBytes;

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      cacheKey: options.cacheKey || null,
      mcpOnly: !!options.mcpOnly,
      limit,
    },
    totals,
    entries: limitedEntries,
  };
}

module.exports = {
  buildBudgetReport,
};