# Figma 链接标准化规范

本规范用于把不同形态的 Figma 分享链接归一为同一个缓存键，避免重复缓存与重复 MCP 拉取。

## 标准键定义

- `fileKey`: 从路径提取（支持 `/file/` 与 `/design/`）
- `nodeId`: 从 `node-id` 提取并归一到冒号格式
- `cacheKey`: `<fileKey>#<nodeId>`
- 无 `node-id` 时：`<fileKey>#__FILE__`

## 规则

1. URL 解码并去除首尾空白。
2. `9278-30678` 这类值转换为 `9278:30678`。
3. 仅 `node-id` 参与定位；`t/page-id/mode/...` 视为无关参数。
