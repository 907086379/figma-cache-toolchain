---
name: figma-ui-dual-mode-execution
description: 仅用 nodeId 或 Figma 链接触发 UI 实现，支持 L0/L1/L2 压缩级别，并内置基线判型与 B0/B1/B2 选择。
---

# Figma UI Dual Mode Execution（分级）

## 执行步骤（固定）
1. 规范化 nodeId 并命中缓存目录。
2. 读取 `spec/raw/state-map/design-context`。
3. 选择压缩级别：L0/L1/L2（默认 L1）。
4. 输出事实对齐清单并实现挂载。
5. lint 验证并输出映射结论。

## 压缩级别
- L0：高保真严格流程（预检文档 + 完整状态）。
- L1：标准流程（精简清单 + 核心状态）。
- L2：快速看效果（先静态后补交互）。

## 基线治理（并入）
- 项目判型：新项目 / 老项目 / 不确定（不确定按老项目）。
- 基线级别：B0/B1/B2（老项目默认 B0）。
- B0（默认）：
  - 复制模板到 `src/styles/generated-ui-reset.css`
  - 入口单次引入
  - 生成组件根节点加 `generate-ui-reset`
- B1：仅新页面/模块范围启用作用域基线。
- B2：全局基线，仅新项目或明确授权。
- 若与规则冲突，以 `.cursor/rules/04-ui-baseline-governance.mdc` 为准。

## 标签口径
- 默认 `div/span/img`
- 默认禁 `p/ul/li/ol/h1-h6`
- `input/select/textarea/a` 允许
- 原生 `button` 默认禁用（封装/UI 库按钮除外）
- `role/aria-*` 默认不强制
- `data-node-id/data-name` 默认不输出