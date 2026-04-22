module.exports = function handleFlow(args, context) {
  const {
    handleFlowCommand,
    resolveFlowIdFromArgs,
    parseCompletenessFromArgs,
    normalizeIndexShape,
    readIndex,
    writeIndex,
    normalizeFigmaUrl,
    getItem,
    upsertByUrl,
    ensureEntryFilesAndHook,
  } = context;

  handleFlowCommand(args, {
    resolveFlowIdFromArgs,
    parseCompletenessFromArgs,
    normalizeIndexShape,
    readIndex,
    writeIndex,
    normalizeFigmaUrl,
    getItem,
    upsertByUrl,
    ensureEntryFilesAndHook,
  });
};