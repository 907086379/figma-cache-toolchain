# 栈相关参考（不随 `cursor init` 复制）

本目录存放 **可选** 的完整 Adapter 示例，供人工或 Agent 对照；**通用默认**请使用 `cursor init` 生成的 `02-figma-stack-adapter.mdc` 与根目录 `figma-cache.config.js`。

| 文件 | 说明 |
|------|------|
| `vue2-vuetify2-adapter.reference.mdc` | 历史 Vue 2 + Vuetify 2 表现层规则全文，可复制为 `.cursor/rules/02-figma-vuetify2-adapter.mdc` 并按项目改名 |

将参考规则复制进 `.cursor/rules/` 后，建议同步 `figma-cache.config.js` 的 adapter 提示策略：默认使用 `FIGMA_CACHE_ADAPTER_DOC_MODE=cache-root`（目录级单文件），仅在明确需要节点文档时改为 `node`。


