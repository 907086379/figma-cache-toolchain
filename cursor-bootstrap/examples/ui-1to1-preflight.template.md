# UI 1:1 实现前预检模板

> 用途：在“开始写组件前”完成事实快照、状态对照与预检，降低返工。  
> 适用：Figma 缓存驱动实现（任意 nodeId）。

## 0. 基本信息

- fileKey:
- nodeId:
- cachePath:
- 实现目标页面/组件路径:
- 执行模式（短流程 / 严格流程）:

## 1. 设计值快照（Design Facts）

### 1.1 结构与尺寸

- 根容器（宽/高/圆角/边框/背景）:
- 关键子容器尺寸:
- 宽度策略（固定 / 自适应，仅可选一）:
- 对齐策略（左/右/居中）:

### 1.2 文案

- 标签文本:
- 值文本:
- 选项文本:

### 1.3 Token

- 字体（size/line-height/weight/letter-spacing）:
- 主文本色:
- 次文本色:
- 背景色:
- 边框色:
- 状态色（hover/focus/selected）:

### 1.4 交互与语义

- 交互触发（click/esc/outside/keyboard）:
- 语义角色（combobox/listbox/option 等）:
- 禁止项（本任务）:

## 2. 状态对照表（必须填写）

| 状态 | 背景 | 边框 | 文本 | 图标 | 数据状态 | 是否实现 |
| --- | --- | --- | --- | --- | --- | --- |
| default |  |  |  |  |  | [ ] |
| hover |  |  |  |  |  | [ ] |
| focus |  |  |  |  |  | [ ] |
| active |  |  |  |  |  | [ ] |
| expanded |  |  |  |  |  | [ ] |
| selected |  |  |  |  |  | [ ] |
| unselected |  |  |  |  |  | [ ] |
| disabled（若存在） |  |  |  |  |  | [ ] |

## 3. 1:1 预检清单（实现前）

- [ ] 已读取 `spec.md` / `raw.json` / `state-map.md` / `mcp-raw-get-design-context.txt`
- [ ] 冲突裁决规则确认：`mcp-raw-get-design-context.txt` 优先
- [ ] 全组件盒模型策略一致（建议 `box-border`）
- [ ] 文本溢出策略明确（`min-w-0` + `truncate` 或等效）
- [ ] 弹层锚定触发器（非页面硬编码定位）
- [ ] 图标策略确认（项目图标库优先；兜底 `inline svg`）
- [ ] 禁止使用 Figma 临时远程资产 URL 作为运行时图标
- [ ] 禁止无意义标签嵌套
- [ ] 默认无横向滚动

## 4. 实现后验收（最小）

- [ ] 改动文件 lint 通过
- [ ] 关键状态可见且可切换（至少 default/expanded/selected/unselected）
- [ ] 关键视觉项（尺寸/对齐/图标居中）通过
- [ ] 输出“设计值 -> 代码映射”

## 5. 失败反馈（固定三段）

1. 失败原因
2. 定位信息（文件/字段/样式项）
3. 修复动作
