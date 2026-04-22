module.exports = function handleConfig(args, context) {
  const {
    loadProjectConfig,
    normalizeSlash,
    root,
    cacheDir,
    indexPath,
    iterationsDir,
    defaultStaleDays,
    defaultFlowId,
    defaultCompleteness,
    normalizationVersion,
    getProjectConfigPath,
  } = context;

  if (Array.isArray(args) && args.length > 0) {
    // 保持兼容：忽略额外参数
  }

  const cfg = loadProjectConfig();
  const hooks = cfg && cfg.hooks;
  console.log(
    JSON.stringify(
      {
        root: normalizeSlash(root),
        cacheDir: normalizeSlash(cacheDir),
        indexPath: normalizeSlash(indexPath),
        iterationsDir: normalizeSlash(iterationsDir),
        staleDays: defaultStaleDays,
        defaultFlowId: defaultFlowId || null,
        defaultCompleteness: [...defaultCompleteness],
        normalizationVersion,
        projectConfigPath: getProjectConfigPath(),
        hooks: {
          postEnsure: !!(hooks && typeof hooks.postEnsure === "function"),
        },
      },
      null,
      2,
    ),
  );
};