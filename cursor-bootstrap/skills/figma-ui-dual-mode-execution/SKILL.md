---
name: figma-ui-dual-mode-execution
description: 仅用 nodeId（如 9277-28772）或 Figma 链接触发 UI 实现，自动在短流程与严格流程间切换。
---

# Figma UI Dual Mode Execution

本 Skill 用于：用户仅提供节点线索（节点目录名、nodeId、或带 node-id 的 Figma 链接）时，自动完成“定位缓存 -> 判定模式 -> 实现与验证”。

## 支持输入

- 节点目录名：如 `9277-28772`
- nodeId：如 `9277:28772`
- Figma 链接：`...node-id=9277-28772`（需转换为 `9277:28772`）

## 执行步骤（强制）

1. 规范化节点标识：
   - `9277-28772` -> `9277:28772`
2. 在 `figma-cache/index.json` 查命中并定位节点目录。
3. 读取四份必读文件：
   - `spec.md`
   - `raw.json`
   - `state-map.md`
   - `mcp-raw-get-design-context.txt`
4. 模式选择：
   - 默认短流程；
   - 命中任一升级条件（老项目/全局样式改动/复杂状态/历史漂移问题/信息冲突）-> 切严格流程。
5. 预检文档策略（降噪）：
   - 默认短流程：可跳过完整预检文档，仅输出精简事实清单。
   - 严格流程：必须基于 `cursor-bootstrap/examples/ui-1to1-preflight.template.md` 生成并填写“预检文档”（可落到项目 `figma-cache/docs/` 或节点目录旁），至少完成：设计值快照、状态对照表、1:1 预检清单。
6. 先输出“事实对齐清单”，再实现组件与挂载。
7. 改动后执行 lint，并输出映射与验证结论。

## 关键硬约束

- 冲突裁决顺序：`mcp-raw-get-design-context.txt` 优先。
- 禁止猜测设计值；无法裁决必须先提问。
- 禁止使用 Figma 临时远程资产 URL 作为运行时图标。
- 图标优先项目图标系统；无则 `inline svg`。
- 默认按 `border-box` 思维实现；弹层必须锚定触发器。

## 固定输出

1. 缓存定位结果（命中节点目录）
2. 事实对齐清单（结构/文案/token/状态/交互）
3. 变更文件列表
4. 关键设计值 -> 代码映射
5. lint/验证结果
6. 未决问题（如有）
