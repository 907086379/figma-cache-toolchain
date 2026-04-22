module.exports = function handleNormalize(args, context) {
  const { parseTailWithCli, normalizeFigmaUrl } = context;
  const { positionals } = parseTailWithCli(args, {
    strings: [],
    booleanFlags: [],
  });
  const url = positionals[0];
  if (!url) {
    console.error("Usage: figma-cache normalize <figmaUrl>");
    process.exit(1);
  }
  const normalized = normalizeFigmaUrl(url);
  console.log(JSON.stringify(normalized, null, 2));
};