module.exports = function handleCursor(args, context) {
  const {
    parseTailWithCli,
    copyCursorBootstrap,
    fs,
    path,
    root,
    cacheDir,
    cursorBootstrapDir,
    normalizeSlash,
    readSelfNpmPackageName,
    packageDir,
  } = context;

  const sub = args[0];
  if (sub !== "init") {
    console.error(
      "Usage: figma-cache cursor init [--overwrite] [--force]  # --overwrite replaces existing templates; --force keeps legacy no-overwrite behavior",
    );
    process.exit(1);
  }
  const { flags } = parseTailWithCli(args, {
    strings: [],
    booleanFlags: ["overwrite", "force"],
  });
  const hasOverwrite = Boolean(flags.overwrite);
  const hasForce = Boolean(flags.force);
  if (hasOverwrite && hasForce) {
    console.error("Do not use --overwrite and --force together. Choose one mode.");
    process.exit(1);
  }

  copyCursorBootstrap(
    { overwrite: hasOverwrite, legacyForce: hasForce },
    {
      fs,
      path,
      ROOT: root,
      CACHE_DIR: cacheDir,
      CURSOR_BOOTSTRAP_DIR: cursorBootstrapDir,
      normalizeSlash,
      readSelfNpmPackageName,
      packageDir,
    },
  );
};