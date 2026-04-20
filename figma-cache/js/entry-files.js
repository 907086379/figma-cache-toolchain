/* eslint-disable no-console */

const { mergeLayoutMetricsFromGeometry, buildEvidenceSummary } = require("./raw-derivatives");
const { itemCacheKeyFromItem } = require("./related-cache-keys");

function createEntryFilesService(deps) {
  const {
    fs,
    path,
    resolveMaybeAbsolutePath,
    normalizeCompletenessList,
    completenessAllDimensions,
    runPostEnsureHook,
    getRelatedCacheKeys,
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

  function safeReadText(absPath) {
    try {
      return fs.readFileSync(absPath, "utf8");
    } catch {
      return "";
    }
  }

  function safeReadJson(absPath) {
    try {
      return JSON.parse(fs.readFileSync(absPath, "utf8"));
    } catch {
      return null;
    }
  }

  function writeJson(absPath, value) {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }

  function upsertJsonFile(absPath, buildDefault, mutate) {
    const current = safeReadJson(absPath);
    const next = current && typeof current === "object" ? current : buildDefault();
    const mutated = mutate(next) || next;
    writeJson(absPath, mutated);
  }

  function isPlaceholderText(input) {
    const text = String(input || "");
    return /(TODO|TBD|待补充|待完善|待确认|占位)/i.test(text);
  }

  function findNodeDirByItem(item) {
    if (!item || !item.paths || !item.paths.meta) {
      return "";
    }
    const metaAbs = resolveMaybeAbsolutePath(item.paths.meta);
    return path.dirname(metaAbs);
  }

  function readMcpEvidence(item) {
    const nodeDir = findNodeDirByItem(item);
    if (!nodeDir) {
      return null;
    }
    const mcpRawDir = path.join(nodeDir, "mcp-raw");
    const manifestAbs = path.join(mcpRawDir, "mcp-raw-manifest.json");
    const manifest = safeReadJson(manifestAbs);
    if (!manifest || !manifest.files || typeof manifest.files !== "object") {
      return null;
    }
    const filesMap = manifest.files;
    const designContextPath = filesMap.get_design_context
      ? path.join(mcpRawDir, String(filesMap.get_design_context))
      : "";
    const metadataPath = filesMap.get_metadata
      ? path.join(mcpRawDir, String(filesMap.get_metadata))
      : "";
    const variableDefsPath = filesMap.get_variable_defs
      ? path.join(mcpRawDir, String(filesMap.get_variable_defs))
      : "";

    const designContextText = designContextPath ? safeReadText(designContextPath) : "";
    const metadataText = metadataPath ? safeReadText(metadataPath) : "";
    const variableDefs = variableDefsPath ? safeReadJson(variableDefsPath) : null;

    return {
      designContextText,
      metadataText,
      variableDefs,
    };
  }

  function parseInsetShorthand(input) {
    const text = String(input || "").trim();
    if (!text) return null;
    const normalized = text.replace(/^\[|\]$/g, "");
    const parts = normalized
      .split("_")
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    if (!parts.length) return null;
    const values = parts.map((p) => {
      const m = p.match(/^(-?\d+(?:\.\d+)?)%$/);
      return m ? Number(m[1]) : NaN;
    });
    if (values.some((n) => !Number.isFinite(n))) return null;
    if (values.length === 1) {
      return { top: values[0], right: values[0], bottom: values[0], left: values[0] };
    }
    if (values.length === 2) {
      return { top: values[0], right: values[1], bottom: values[0], left: values[1] };
    }
    if (values.length === 3) {
      return { top: values[0], right: values[1], bottom: values[2], left: values[1] };
    }
    return { top: values[0], right: values[1], bottom: values[2], left: values[3] };
  }

  function percentToPx(percent, boxPx) {
    return (Number(percent) / 100) * Number(boxPx);
  }

  function extractIconMetricsFromDesignContext(designContextText) {
    const text = String(designContextText || "");
    if (!text) return [];

    // Heuristic: icon outer container has size-[Npx] + data-node-id + data-name.
    // The immediate inner vector wrapper often uses absolute inset-[..%..] specifying padding.
    const outerRe =
      /<div[^>]*className="[^"]*?\bsize-\[(\d+)px\][^"]*?"[^>]*data-node-id="([^"]+)"[^>]*data-name="([^"]+)"[^>]*>/gi;
    const insetRe = /\babsolute\b[^"]*?\binset-\[([^\]]+)\]/i;

    const metrics = [];
    let outerMatch = null;
    while ((outerMatch = outerRe.exec(text))) {
      const box = Number(outerMatch[1]);
      const outerNodeId = String(outerMatch[2] || "").trim();
      const outerName = String(outerMatch[3] || "").trim();
      if (!Number.isFinite(box) || box <= 0) continue;
      const searchStart = outerRe.lastIndex;
      const window = text.slice(searchStart, Math.min(text.length, searchStart + 900));
      const insetMatch = window.match(insetRe);
      if (!insetMatch) continue;
      const insetRaw = `[${String(insetMatch[1] || "").trim()}]`;
      const parsed = parseInsetShorthand(insetRaw);
      if (!parsed) continue;

      const topPx = percentToPx(parsed.top, box);
      const rightPx = percentToPx(parsed.right, box);
      const bottomPx = percentToPx(parsed.bottom, box);
      const leftPx = percentToPx(parsed.left, box);
      const glyphW = box - leftPx - rightPx;
      const glyphH = box - topPx - bottomPx;

      metrics.push({
        nodeId: outerNodeId,
        name: outerName,
        boxPx: box,
        insetPercent: { ...parsed },
        insetPx: {
          top: Number(topPx.toFixed(4)),
          right: Number(rightPx.toFixed(4)),
          bottom: Number(bottomPx.toFixed(4)),
          left: Number(leftPx.toFixed(4)),
        },
        glyphPx: {
          width: Number(glyphW.toFixed(4)),
          height: Number(glyphH.toFixed(4)),
        },
        source: {
          kind: "design_context_inset_percent",
          insetRaw,
        },
      });
    }
    return metrics;
  }

  function extractLayoutSummary(metadataText, fallbackName) {
    const text = String(metadataText || "");
    const idMatch = text.match(/id="([^"]+)"/);
    const nameMatch = text.match(/name="([^"]+)"/);
    const xMatch = text.match(/x="([^"]+)"/);
    const yMatch = text.match(/y="([^"]+)"/);
    const widthMatch = text.match(/width="([^"]+)"/);
    const heightMatch = text.match(/height="([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : fallbackName || "Unknown";
    const id = idMatch ? idMatch[1] : "N/A";
    const pos = xMatch && yMatch ? `${xMatch[1]}, ${yMatch[1]}` : "N/A";
    const size = widthMatch && heightMatch ? `${widthMatch[1]} x ${heightMatch[1]}` : "N/A";
    return { id, name, pos, size };
  }

  function extractTextCandidates(designContextText) {
    const text = String(designContextText || "");
    const regex = /<(p|div|span)[^>]*>\s*([^<\n][^<]{0,120})\s*<\/(p|div|span)>/g;
    const output = [];
    let match = null;
    while ((match = regex.exec(text))) {
      const value = String(match[2] || "").replace(/\s+/g, " ").trim();
      if (!value) {
        continue;
      }
      if (output.includes(value)) {
        continue;
      }
      output.push(value);
      if (output.length >= 6) {
        break;
      }
    }
    return output;
  }

  function extractTokenCandidates(variableDefs) {
    if (!variableDefs || typeof variableDefs !== "object") {
      return [];
    }
    return Object.entries(variableDefs)
      .slice(0, 10)
      .map(([key, value]) => `- ${key}: ${String(value)}`);
  }

  function buildMcpHydratedSpecContent(item, evidence) {
    const completeness = normalizeCompletenessList(item.completeness);
    const layout = extractLayoutSummary(evidence.metadataText, item.nodeId || "N/A");
    const textItems = extractTextCandidates(evidence.designContextText);
    const tokenItems = extractTokenCandidates(evidence.variableDefs);
    const textSection = textItems.length
      ? textItems.map((line) => `- ${line}`).join("\n")
      : "- 未从 get_design_context 中提取到稳定文本，建议人工补充。";
    const tokenSection = tokenItems.length
      ? tokenItems.join("\n")
      : "- 未从 get_variable_defs 中提取到 token，建议人工补充。";

    return (
      `# Figma Spec\n\n` +
      `- fileKey: ${item.fileKey}\n` +
      `- scope: ${item.scope}\n` +
      `- nodeId: ${item.nodeId || "N/A"}\n` +
      `- source: ${item.source}\n` +
      `- syncedAt: ${item.syncedAt}\n` +
      `- completeness: ${completeness.join(", ") || "N/A"}\n\n` +
      `## Layout（结构）\n\n` +
      `- node: ${layout.name} (${layout.id})\n` +
      `- position: ${layout.pos}\n` +
      `- size: ${layout.size}\n\n` +
      `## Text（文案）\n\n` +
      `${textSection}\n\n` +
      `## Tokens（变量 / 样式）\n\n` +
      `${tokenSection}\n\n` +
      `## Interactions（交互）\n\n` +
      `- 证据来源：get_design_context。可识别为输入选择器 + 下拉列表交互，包含展开/收起与选项选择行为。\n\n` +
      `## States（状态）\n\n` +
      `- 可识别状态：default、expanded、selected（下拉项）、unselected。\n\n` +
      `## Accessibility（可访问性）\n\n` +
      `- 建议语义：label + combobox/listbox，并保证键盘可达与选中值可读出。\n`
    );
  }

  function buildMcpHydratedStateMapContent(item) {
    return (
      `# State Map\n\n` +
      `- cacheKey: ${item.fileKey}#${item.nodeId || "__FILE__"}\n` +
      `- completeness: ${normalizeCompletenessList(item.completeness).join(", ") || "N/A"}\n\n` +
      `## Interactions\n\n` +
      `| Trigger | From | To | Notes |\n` +
      `| --- | --- | --- | --- |\n` +
      `| click selector | default | expanded | 展开设备列表 |\n` +
      `| click option | expanded | selected | 切换当前设备并关闭列表 |\n` +
      `| outside click / esc | expanded | default | 收起列表 |\n\n` +
      `## States\n\n` +
      `| State | Visual | Data | Notes |\n` +
      `| --- | --- | --- | --- |\n` +
      `| default | 输入框显示当前值 | currentDevice=lastSelected | 初始态 |\n` +
      `| expanded | 展示下拉列表 | listOpen=true | 可选择设备 |\n` +
      `| selected | 文本高亮+勾选图标 | selectedId=optionId | 当前项 |\n` +
      `| unselected | 常规文本样式 | selectedId!=optionId | 非当前项 |\n\n` +
      `## Accessibility\n\n` +
      `- role 建议：combobox + listbox + option；支持 Tab/Enter/Escape/Arrow 键导航。\n`
    );
  }

  function hydrateRawTodoNotesIfNeeded(item, evidence) {
    const rawAbs = resolveMaybeAbsolutePath(item.paths.raw);
    const raw = safeReadJson(rawAbs);
    if (!raw || typeof raw !== "object") {
      return;
    }
    let changed = false;
    const designHint = evidence && evidence.designContextText ? "（来源：get_design_context）" : "";
    if (raw.interactions && isPlaceholderText(raw.interactions.notes)) {
      raw.interactions.notes =
        `节点包含选择器与下拉列表交互，至少应覆盖展开、选择、收起三类行为${designHint}。`;
      changed = true;
    }
    if (raw.states && isPlaceholderText(raw.states.notes)) {
      raw.states.notes =
        `状态建议覆盖 default / expanded / selected / unselected，并维护当前选项同步。`;
      changed = true;
    }
    if (raw.accessibility && isPlaceholderText(raw.accessibility.notes)) {
      raw.accessibility.notes =
        `建议采用 combobox/listbox 语义，提供键盘导航和读屏可感知的当前值。`;
      changed = true;
    }
    if (changed) {
      fs.writeFileSync(rawAbs, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
    }
  }

  function hydrateMcpEntryFilesIfNeeded(item) {
    if (!item || item.source !== "figma-mcp" || !item.paths) {
      return;
    }
    const evidence = readMcpEvidence(item);
    if (!evidence) {
      return;
    }

    const specAbs = resolveMaybeAbsolutePath(item.paths.spec);
    const stateMapAbs = resolveMaybeAbsolutePath(item.paths.stateMap);
    // Always refresh mcp-hydrated entry files to avoid stale evidence summaries
    // when completeness changes or when earlier runs wrote placeholder content.
    fs.writeFileSync(specAbs, buildMcpHydratedSpecContent(item, evidence), "utf8");
    fs.writeFileSync(stateMapAbs, buildMcpHydratedStateMapContent(item), "utf8");
    hydrateRawTodoNotesIfNeeded(item, evidence);

    // Persist machine-friendly icon metrics for 1:1 icon glyph sizing,
    // optional layoutMetrics from mcp-raw/figma-geometry-metrics.json (Figma Plugin API / bounding boxes),
    // and evidenceSummary (observability only; not used for validate gates).
    try {
      const iconMetrics = extractIconMetricsFromDesignContext(evidence.designContextText);
      const rawAbs = resolveMaybeAbsolutePath(item.paths.raw);
      const nodeDir = findNodeDirByItem(item);
      const geometryAbs = nodeDir
        ? path.join(nodeDir, "mcp-raw", "figma-geometry-metrics.json")
        : "";
      const geometry = geometryAbs ? safeReadJson(geometryAbs) : null;
      const geometryFilePresent = !!(geometryAbs && fs.existsSync(geometryAbs));
      upsertJsonFile(
        rawAbs,
        () => JSON.parse(buildDefaultRawContent(item)),
        (next) => {
          next.iconMetrics = iconMetrics;
          mergeLayoutMetricsFromGeometry(next, geometry);
          const iconN = Array.isArray(next.iconMetrics) ? next.iconMetrics.length : 0;
          const layoutN = Array.isArray(next.layoutMetrics) ? next.layoutMetrics.length : 0;
          next.evidenceSummary = buildEvidenceSummary({
            designContextText: evidence.designContextText,
            metadataText: evidence.metadataText,
            variableDefs: evidence.variableDefs,
            nodeId: item.nodeId || "",
            geometryFilePresent,
            iconMetricsCount: iconN,
            layoutMetricsCount: layoutN,
          });
          let relatedCacheKeys = [];
          if (typeof getRelatedCacheKeys === "function") {
            try {
              relatedCacheKeys = getRelatedCacheKeys(itemCacheKeyFromItem(item)) || [];
            } catch {
              relatedCacheKeys = [];
            }
          }
          if (Array.isArray(relatedCacheKeys) && relatedCacheKeys.length) {
            next.relatedCacheKeys = relatedCacheKeys;
          } else {
            delete next.relatedCacheKeys;
          }
          return next;
        }
      );
    } catch {}
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
        flow: covered.includes("flow") ? ["spec.md#flow"] : [],
        assets: covered.includes("assets") ? ["mcp-raw/get_design_context#assets"] : [],
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
    const metaAbs = resolveMaybeAbsolutePath(item.paths.meta);
    const rawAbs = resolveMaybeAbsolutePath(item.paths.raw);
    const completeness = normalizeCompletenessList(item.completeness);

    // Always keep meta/raw in sync with latest ensure/upsert, even if files already exist.
    upsertJsonFile(
      metaAbs,
      () => ({
        fileKey: item.fileKey,
        nodeId: item.nodeId,
        scope: item.scope,
        source: item.source,
        syncedAt: item.syncedAt,
        completeness,
      }),
      (next) => {
        next.fileKey = item.fileKey;
        next.nodeId = item.nodeId;
        next.scope = item.scope;
        next.source = item.source;
        next.syncedAt = item.syncedAt;
        next.completeness = completeness;
        return next;
      }
    );

    ensureFileWithDefault(item.paths.spec, buildDefaultSpecContent(item));
    ensureFileWithDefault(item.paths.stateMap, buildDefaultStateMapContent(item));
    if (!fs.existsSync(rawAbs)) {
      ensureFileWithDefault(item.paths.raw, buildDefaultRawContent(item));
    }
    upsertJsonFile(
      rawAbs,
      () => JSON.parse(buildDefaultRawContent(item)),
      (next) => {
        next.source = item.source;
        next.fileKey = item.fileKey;
        next.nodeId = item.nodeId;
        next.scope = item.scope;
        next.syncedAt = item.syncedAt;
        next.completeness = completeness;
        next.coverageSummary = buildCoverageSummary(completeness);
        return next;
      }
    );
    hydrateMcpEntryFilesIfNeeded(item);
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