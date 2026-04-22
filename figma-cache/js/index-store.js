/* eslint-disable no-console */
const path = require("path");

function createIndexStore(options) {
  const {
    fs,
    CACHE_DIR,
    INDEX_PATH,
    SCHEMA_VERSION,
    NORMALIZATION_VERSION,
  } = options;

  function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  function buildEmptyIndex() {
    return {
      schemaVersion: SCHEMA_VERSION,
      version: 1,
      normalizationVersion: NORMALIZATION_VERSION,
      updatedAt: null,
      flows: {},
      items: {},
    };
  }

  function normalizeIndexShape(index) {
    if (!index || typeof index !== "object") {
      return buildEmptyIndex();
    }
    if (!index.schemaVersion) {
      index.schemaVersion = SCHEMA_VERSION;
    }
    if (!index.flows || typeof index.flows !== "object") {
      index.flows = {};
    }
    if (!index.items || typeof index.items !== "object") {
      index.items = {};
    }
    if (!index.version) {
      index.version = 1;
    }
    if (!index.normalizationVersion) {
      index.normalizationVersion = NORMALIZATION_VERSION;
    }
    return index;
  }

  function readIndex() {
    ensureCacheDir();
    if (!fs.existsSync(INDEX_PATH)) {
      return buildEmptyIndex();
    }
    const raw = fs.readFileSync(INDEX_PATH, "utf8");
    return normalizeIndexShape(JSON.parse(raw));
  }

  function removeFileIfExists(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // noop
    }
  }

  function writeIndex(index) {
    ensureCacheDir();
    const normalized = normalizeIndexShape(index);
    normalized.version = 1;
    normalized.schemaVersion = SCHEMA_VERSION;
    normalized.normalizationVersion = NORMALIZATION_VERSION;
    normalized.updatedAt = new Date().toISOString();

    const payload = `${JSON.stringify(normalized, null, 2)}\n`;
    const indexDir = path.dirname(INDEX_PATH);
    const indexBase = path.basename(INDEX_PATH);
    const tmpPath = path.join(
      indexDir,
      `${indexBase}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    );

    fs.writeFileSync(tmpPath, payload, "utf8");
    try {
      fs.renameSync(tmpPath, INDEX_PATH);
      return;
    } catch (renameError) {
      const canRetryByReplacing =
        renameError &&
        (renameError.code === "EEXIST" ||
          renameError.code === "EPERM" ||
          renameError.code === "EACCES");
      if (!canRetryByReplacing) {
        removeFileIfExists(tmpPath);
        throw renameError;
      }
    }

    try {
      removeFileIfExists(INDEX_PATH);
      fs.renameSync(tmpPath, INDEX_PATH);
    } catch (replaceError) {
      removeFileIfExists(tmpPath);
      throw replaceError;
    }
  }

  function getItem(index, cacheKey) {
    const normalized = normalizeIndexShape(index);
    return normalized.items && normalized.items[cacheKey] ? normalized.items[cacheKey] : null;
  }

  return {
    ensureCacheDir,
    buildEmptyIndex,
    normalizeIndexShape,
    readIndex,
    writeIndex,
    getItem,
  };
}

module.exports = {
  createIndexStore,
};