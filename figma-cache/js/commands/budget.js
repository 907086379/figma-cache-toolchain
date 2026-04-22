module.exports = function handleBudget(args, context) {
  const {
    parseTailWithCli,
    buildBudgetReport,
    path,
    normalizeIndexShape,
    readIndex,
    resolveMaybeAbsolutePath,
    safeReadJson,
    safeFileSize,
  } = context;

  const { values, flags } = parseTailWithCli(args, {
    strings: ["cacheKey", "limit"],
    booleanFlags: ["mcp-only"],
  });

  const report = buildBudgetReport(
    {
      mcpOnly: Boolean(flags["mcp-only"]),
      cacheKey: (values.cacheKey || "").trim(),
      limit: (values.limit || "").trim(),
    },
    {
      path,
      normalizeIndexShape,
      readIndex,
      resolveMaybeAbsolutePath,
      safeReadJson,
      safeFileSize,
    },
  );
  console.log(JSON.stringify(report, null, 2));
};