module.exports = function handleBackfill(args, context) {
  const { backfillFromIterations, iterationsDir, fs, path, upsertByUrl } = context;
  if (Array.isArray(args) && args.length > 0) {
    // 保持兼容：忽略额外参数
  }
  backfillFromIterations(
    { iterationsDir },
    {
      fs,
      path,
      upsertByUrl,
    },
  );
};