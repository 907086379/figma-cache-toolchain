module.exports = function handleContractCheck(args, context) {
  const {
    parseTailWithCli,
    resolveMaybeAbsolutePath,
    buildContractCheckReport,
    readIndex,
    safeReadJson,
    safeReadText,
    normalizeSlash,
  } = context;

  const options = parseContractCheckArgs(args, parseTailWithCli);
  const contractPath = resolveMaybeAbsolutePath(
    process.env.FIGMA_CACHE_ADAPTER_CONTRACT ||
      "figma-cache/adapters/ui-adapter.contract.json",
  );

  const report = buildContractCheckReport(
    {
      ...options,
      contractPath,
    },
    {
      index: readIndex(),
      contract: safeReadJson(contractPath),
      readJsonOrNull: safeReadJson,
      readTextOrEmpty: safeReadText,
      resolveMaybeAbsolutePath,
      normalizeSlash,
    },
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
      2,
    ),
  );
};

function parseContractCheckArgs(args, parseTailWithCli) {
  const { values, flags, positionals } = parseTailWithCli(args, {
    strings: ["cacheKey"],
    booleanFlags: ["warn-unmapped-tokens", "warn-unmapped-states"],
  });
  let cacheKey = (values.cacheKey || "").trim();
  if (!cacheKey) {
    const hit = positionals.find((p) => String(p).includes("#"));
    if (hit) {
      cacheKey = String(hit).trim();
    }
  }
  return {
    cacheKey,
    warnUnmappedTokens: Boolean(flags["warn-unmapped-tokens"]),
    warnUnmappedStates: Boolean(flags["warn-unmapped-states"]),
  };
}