module.exports = function handleInit(args, context) {
  const {
    ensureCacheDir,
    fs,
    indexPath,
    normalizeSlash,
    writeIndex,
    buildEmptyIndex,
  } = context;

  if (Array.isArray(args) && args.length > 0) {
    // 保持兼容：忽略额外参数
  }

  ensureCacheDir();
  if (fs.existsSync(indexPath)) {
    console.log(
      JSON.stringify(
        {
          created: false,
          reason: "index_exists",
          indexPath: normalizeSlash(indexPath),
        },
        null,
        2,
      ),
    );
    return;
  }

  writeIndex(buildEmptyIndex());
  console.log(
    JSON.stringify(
      {
        created: true,
        indexPath: normalizeSlash(indexPath),
      },
      null,
      2,
    ),
  );
};