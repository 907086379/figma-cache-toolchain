module.exports = function handleGet(args, context) {
  const { parseTailWithCli, normalizeFigmaUrl, readIndex, getItem } = context;
  const { positionals } = parseTailWithCli(args, {
    strings: [],
    booleanFlags: [],
  });
  const url = positionals[0];
  if (!url) {
    console.error("Usage: figma-cache get <figmaUrl>");
    process.exit(1);
  }
  const normalized = normalizeFigmaUrl(url);
  const index = readIndex();
  const item = getItem(index, normalized.cacheKey);
  console.log(
    JSON.stringify(
      {
        found: !!item,
        cacheKey: normalized.cacheKey,
        item: item || null,
      },
      null,
      2,
    ),
  );
};