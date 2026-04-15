/* eslint-disable no-console */

function createEntryFilesService(deps) {
  const {
    fs,
    path,
    resolveMaybeAbsolutePath,
    normalizeCompletenessList,
    completenessAllDimensions,
    runPostEnsureHook,
  } = deps;

  function ensureFileWithDefault(relativePath, fallbackContent) {
    const absPath = resolveMaybeAbsolutePath(relativePath);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(absPath)) {
      fs.writeFileSync(absPath, fallbackContent, "utf8");
    }
  }

  function buildCoverageSummary(completeness) {
    const covered = normalizeCompletenessList(completeness);
    const missing = completenessAllDimensions.filter((dim) => !covered.includes(dim));
    return {
      covered,
      missing,
      evidence: {
        layout: covered.includes("layout") ? ["spec.md#layout"] : [],
        text: covered.includes("text") ? ["spec.md#text"] : [],
        tokens: covered.includes("tokens") ? ["spec.md#tokens"] : [],
        interactions: covered.includes("interactions") ? ["state-map.md#interactions"] : [],
        states: covered.includes("states") ? ["state-map.md#states"] : [],
        accessibility: covered.includes("accessibility")
          ? ["state-map.md#accessibility"]
          : [],
      },
    };
  }

  function buildDefaultSpecContent(item) {
    const completeness = normalizeCompletenessList(item.completeness);
    return (
      `# Figma Spec\n\n` +
      `- fileKey: ${item.fileKey}\n` +
      `- scope: ${item.scope}\n` +
      `- nodeId: ${item.nodeId || "N/A"}\n` +
      `- source: ${item.source}\n` +
      `- syncedAt: ${item.syncedAt}\n` +
      `- completeness: ${completeness.join(", ") || "N/A"}\n\n` +
      `## Layout（结构）\n\n` +
      `- TODO: 补充布局结构与关键尺寸。\n\n` +
      `## Text（文案）\n\n` +
      `- TODO: 补充关键文案与语义。\n\n` +
      `## Tokens（变量 / 样式）\n\n` +
      `- TODO: 补充颜色、字体、间距等 token 映射。\n\n` +
      `## Interactions（交互）\n\n` +
      `- TODO: 补充触发条件、状态流转、键盘行为。\n\n` +
      `## States（状态）\n\n` +
      `- TODO: 补充 default / hover / active / focus / disabled 等状态定义。\n\n` +
      `## Accessibility（可访问性）\n\n` +
      `- TODO: 补充 ARIA、焦点顺序、读屏文案和对比度要求。\n`
    );
  }

  function buildDefaultStateMapContent(item) {
    return (
      `# State Map\n\n` +
      `- cacheKey: ${item.fileKey}#${item.nodeId || "__FILE__"}\n` +
      `- completeness: ${normalizeCompletenessList(item.completeness).join(", ") || "N/A"}\n\n` +
      `## Interactions\n\n` +
      `| Trigger | From | To | Notes |\n` +
      `| --- | --- | --- | --- |\n` +
      `| TODO | default | TODO | 补充点击/键盘/失焦行为 |\n\n` +
      `## States\n\n` +
      `| State | Visual | Data | Notes |\n` +
      `| --- | --- | --- | --- |\n` +
      `| default | TODO | TODO | 初始态 |\n` +
      `| hover | TODO | TODO | 悬停态 |\n` +
      `| active | TODO | TODO | 激活态 |\n` +
      `| focus | TODO | TODO | 焦点态 |\n` +
      `| disabled | TODO | TODO | 禁用态 |\n\n` +
      `## Accessibility\n\n` +
      `- TODO: 补充 role / aria-* / tab 顺序 / 键盘行为。\n`
    );
  }

  function buildDefaultRawContent(item) {
    const completeness = normalizeCompletenessList(item.completeness);
    return `${JSON.stringify(
      {
        source: item.source,
        fileKey: item.fileKey,
        nodeId: item.nodeId,
        scope: item.scope,
        syncedAt: item.syncedAt,
        completeness,
        coverageSummary: buildCoverageSummary(completeness),
        interactions: {
          notes: "TODO: 补充点击、键盘、失焦、外部点击等交互规则。",
        },
        states: {
          notes: "TODO: 补充状态矩阵（default/hover/active/focus/disabled）。",
        },
        accessibility: {
          notes: "TODO: 补充 ARIA、焦点管理、读屏文本、无障碍要求。",
        },
      },
      null,
      2
    )}\n`;
  }

  function ensureEntryFiles(item) {
    ensureFileWithDefault(
      item.paths.meta,
      `${JSON.stringify(
        {
          fileKey: item.fileKey,
          nodeId: item.nodeId,
          scope: item.scope,
          source: item.source,
          syncedAt: item.syncedAt,
          completeness: normalizeCompletenessList(item.completeness),
        },
        null,
        2
      )}\n`
    );
    ensureFileWithDefault(item.paths.spec, buildDefaultSpecContent(item));
    ensureFileWithDefault(item.paths.stateMap, buildDefaultStateMapContent(item));
    ensureFileWithDefault(item.paths.raw, buildDefaultRawContent(item));
  }

  function ensureEntryFilesAndHook(cacheKey, item) {
    ensureEntryFiles(item);
    runPostEnsureHook(cacheKey, item);
  }

  return {
    ensureEntryFilesAndHook,
  };
}

module.exports = {
  createEntryFilesService,
};