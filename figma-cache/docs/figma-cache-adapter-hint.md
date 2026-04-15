# Figma 缓存 → UI 实现（目录级提示）

本文件由示例 `postEnsure` 生成，默认放在 **figma-cache 目录级**，用于避免“每个节点重复生成同一提示”。

- **默认来源优先级**：先用 `raw.json` / `spec.md` / `meta.json` / `state-map.md`，仅在缺口或冲突时再读 `mcp-raw/*`
- **证据约束**：同一设计事实只保留一个主证据来源，避免重复引用
- **命中检查**：先查本地缓存命中与字段覆盖，再决定是否需要 MCP 补齐

可选模式（环境变量）：
- `FIGMA_CACHE_ADAPTER_DOC_MODE=cache-root`（默认）
- `FIGMA_CACHE_ADAPTER_DOC_MODE=node`（按节点写入）
- `FIGMA_CACHE_ADAPTER_DOC_MODE=off`（关闭）

最近触发：`abcABCd0123456789vWxyZ#1:2`（`2026-04-15T07:24:18.617Z`）
