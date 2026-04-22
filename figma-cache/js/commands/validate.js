module.exports = function handleValidate(args, context) {
  const {
    readIndex,
    validateIndex,
    fs,
    path,
    normalizeIndexShape,
    normalizeCompletenessList,
    resolveMaybeAbsolutePath,
    safeReadJson,
    normalizeSlash,
    completenessToolRequirements,
    loadProjectConfig,
  } = context;

  if (Array.isArray(args) && args.length > 0) {
    // 保持兼容：忽略额外参数
  }

  const index = readIndex();
  const errors = validateIndex(index, {
    fs,
    path,
    normalizeIndexShape,
    normalizeCompletenessList,
    resolveMaybeAbsolutePath,
    safeReadJson,
    normalizeSlash,
    completenessToolRequirements,
    loadProjectConfig,
  });

  if (!errors.length) {
    console.log("Validation passed.");
    return;
  }
  console.error("Validation failed:");
  errors.forEach((err) => console.error(`- ${err}`));
  process.exit(2);
};