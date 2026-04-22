module.exports = function handleEnrich(args, context) {
  const {
    parseTailWithCli,
    normalizeIndexShape,
    readIndex,
    normalizeCompletenessList,
    validateMcpRawEvidence,
    ensureEntryFilesAndHook,
    normalizeFigmaUrl,
    getItem,
    buildMcpValidationDeps,
  } = context;

  const { flags, positionals } = parseTailWithCli(args, {
    strings: [],
    booleanFlags: ["allow-skeleton-with-figma-mcp", "all"],
  });
  const allowSkeletonWithFigmaMcp = Boolean(flags["allow-skeleton-with-figma-mcp"]);
  const enrichAll = Boolean(flags.all);
  const validateDeps = buildMcpValidationDeps();

  if (enrichAll) {
    const index = normalizeIndexShape(readIndex());
    const failures = [];
    const successes = [];
    Object.entries(index.items || {}).forEach(([cacheKey, item]) => {
      if (!item || item.source !== "figma-mcp") {
        return;
      }
      const completeness = normalizeCompletenessList(item.completeness);
      const mcpErrors = validateMcpRawEvidence(
        cacheKey,
        item,
        completeness,
        { allowSkeletonWithFigmaMcp },
        validateDeps,
      );
      if (mcpErrors.length) {
        failures.push({ cacheKey, errors: mcpErrors });
        return;
      }
      ensureEntryFilesAndHook(cacheKey, item);
      successes.push(cacheKey);
    });

    console.log(
      JSON.stringify(
        {
          ok: failures.length === 0,
          enriched: successes.length,
          cacheKeys: successes,
          failures,
        },
        null,
        2,
      ),
    );
    if (failures.length) {
      process.exit(2);
    }
    return;
  }

  const url = positionals[0];
  if (!url) {
    console.error(
      "Usage: figma-cache enrich <figmaUrl> [--allow-skeleton-with-figma-mcp]\n       figma-cache enrich --all [--allow-skeleton-with-figma-mcp]",
    );
    process.exit(1);
  }

  const normalized = normalizeFigmaUrl(url);
  const index = normalizeIndexShape(readIndex());
  const item = getItem(index, normalized.cacheKey);
  if (!item) {
    console.error(`enrich failed: cacheKey not found in index: ${normalized.cacheKey}`);
    process.exit(2);
  }

  if (item.source === "figma-mcp") {
    const completeness = normalizeCompletenessList(item.completeness);
    const mcpErrors = validateMcpRawEvidence(
      normalized.cacheKey,
      item,
      completeness,
      { allowSkeletonWithFigmaMcp },
      validateDeps,
    );
    if (mcpErrors.length) {
      console.error("enrich failed: source=figma-mcp but MCP raw evidence is incomplete");
      mcpErrors.forEach((err) => console.error(`- ${err}`));
      process.exit(2);
    }
  }

  ensureEntryFilesAndHook(normalized.cacheKey, item);
  console.log(
    JSON.stringify(
      {
        cacheKey: normalized.cacheKey,
        enriched: true,
        paths: item.paths,
      },
      null,
      2,
    ),
  );
};