# Figma Cache：请 Agent 一次性完成项目适配（精简）

> 前提：你在用户业务项目根目录；以下模板来自 `{{NPM_PACKAGE_NAME}}`。

## 必做（按序）
1. 读取项目栈事实（package.json + 构建配置）。
2. 合并/创建 `figma-cache.config.js`（不破坏用户已有逻辑）。
3. 生成 `.cursor/rules/02-figma-<stack>-adapter.mdc`。
4. 验证新 adapter 可用（语法 + 最小执行验证）。
5. 补全 `figma:cache:*` scripts（缺失时）。

## 老项目 UI 基线（默认 B0）
1. 复制模板：
   `node_modules/{{NPM_PACKAGE_NAME}}/cursor-bootstrap/examples/generated-ui-reset.css.template`
   -> 项目 `src/styles/generated-ui-reset.css`
2. 在入口（如 `src/main.ts`）单次引入。
3. 后续生成组件根节点统一加：`generate-ui-reset`。
4. 若用户要求更强控制，再升级 B1/B2。

## 生成完成后清理临时模板文件（强制）
- 删除 `.cursor/rules/02-figma-stack-adapter.mdc`
- 删除 `AGENT-SETUP-PROMPT.md`

## 规则优先级
- 缓存层：`01-figma-cache-core.mdc`
- UI 实现：`03-figma-ui-implementation-hard-constraints.mdc`
- 基线治理：`04-ui-baseline-governance.mdc`
- 输出约束：`00-output-token-budget.mdc`

## UI 标签口径
- 默认优先 `div/span/img`
- 默认禁用 `p/ul/li/ol/h1-h6`（除非用户明确要求）
- `input/select/textarea/a` 可直接使用
- 原生 `button` 默认禁用（封装或 UI 库按钮除外）
- `role/aria-*` 默认不强制
- `data-node-id/data-name` 默认不输出（调试模式除外）

## 输出约束
- 结果优先，不贴 MCP 长原文。
- 仅输出：结论、关键改动、验证结果、下一步。

---
开始执行：直接落文件并完成验证。