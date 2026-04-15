# figma-cache-toolchain

面向业务项目的 Figma 本地缓存工具链：提供链接标准化、索引管理、缓存读写、校验与流程维护能力。该工具链聚焦“Figma -> 本地通用缓存”数据层，不直接绑定具体 UI 框架。

## 快速接入（4 步）

以下步骤建议在业务项目根目录执行。

### 1) 安装

```bash
npm i -D figma-cache-toolchain
```

### 2) 初始化 Cursor 模板与任务书

```bash
npx figma-cache cursor init
```

该命令会：

- 写入或跳过（已存在且未使用 `--force`）`.cursor/rules/`、`.cursor/skills/`，并确保根目录存在 `figma-cache.config.js`
- 每次刷新根目录 `AGENT-SETUP-PROMPT.md`
- 同步刷新 `figma-cache/docs/colleague-guide-zh.md`

### 3) 交给 Cursor Agent 执行一次项目接入

在 Cursor 对话中引用 `@AGENT-SETUP-PROMPT.md`，并让 Agent 按文档执行。

通常会完成：

- 推断技术栈并生成/合并 Adapter 规则
- 合并或生成 `figma-cache.config.js`
- 补全 `figma:cache:*` 相关 scripts

### 4) 初始化本地缓存索引

```bash
npm run figma:cache:init
```

若项目尚未配置 scripts，可临时使用：

```bash
npx figma-cache init
```

随后建议执行一次：

```bash
npm run figma:cache:validate
```

> `cursor init` 与 `figma-cache init` 是两件事：
> - `cursor init` 负责模板与任务书
> - `figma-cache init` 负责创建本地空索引

---

## 日常使用方式

日常通常只需把 Figma 链接发给 Agent，Agent 会按规则自动执行：

1. 查询本地缓存是否命中
2. 信息不足时调用 MCP 拉取最小必要数据
3. 回写 `figma-cache/` 缓存文件
4. 执行 `upsert/ensure` 后自动 `validate`
5. `source=figma-mcp` 场景下，若 MCP 原始证据不完整会直接失败，避免“假成功”

你一般不需要手工跑命令，命令主要用于排障、迁移和验收。

---

## 升级 npm 包后的推荐流程（业务项目）

### 1) 升级依赖

```bash
npm i -D figma-cache-toolchain@latest
```

### 2) 刷新模板与说明文档

```bash
npx figma-cache cursor init
```

### 3) 对齐 `figma-cache.config.js`

- 若你的正式配置是 `require` 包内示例：通常只需重新加载即可。
- 若你的正式配置是历史复制版/自定义版：请与最新模板逻辑做增量合并（可对照 `cursor-bootstrap/figma-cache.config.example.js`），避免整文件覆盖导致自定义钩子丢失。

### 4) 校验

```bash
npm run figma:cache:validate
```

并结合 `CHANGELOG.md` 检查是否存在破坏性变更。

---

## 常用文档入口

- `figma-cache/docs/README.md`：完整脚本、环境变量、回填与维护说明
- `figma-cache/docs/colleague-guide-zh.md`：团队协作指南与提示词模板
- `figma-cache/docs/link-normalization-spec.md`：Figma 链接标准化规范
- `figma-cache/docs/flow-edge-taxonomy.md`：流程边类型约定
- `AGENT-SETUP-PROMPT.md`：项目接入任务书（由 `cursor init` 每次刷新）

---

## 常用命令（参考）

```bash
npm run figma:cache:init
npm run figma:cache:config
npm run figma:cache:get -- "<figma-url>"
npm run figma:cache:ensure -- "<figma-url>" --source=manual --completeness=layout,text,tokens,interactions,states,accessibility
npm run figma:cache:upsert -- "<figma-url>" --source=figma-mcp --completeness=layout,text,tokens,interactions,states,accessibility
npm run figma:cache:upsert -- "<figma-url>" --source=figma-mcp --completeness=layout,text,tokens --allow-skeleton-with-figma-mcp
npm run figma:cache:ensure -- "<figma-url>" --source=figma-mcp --completeness=layout,text,tokens --allow-skeleton-with-figma-mcp
npm run figma:cache:validate
npm run figma:cache:budget
npm run figma:cache:stale
npm run figma:cache:backfill
```

---

## 严格证据模式（默认开启）

- 当 `source=figma-mcp` 时，`upsert/ensure` 会先校验 `mcp-raw` 证据映射；缺失即失败（退出码 2）。
- 仅在你明确需要先落索引骨架时，才使用 `--allow-skeleton-with-figma-mcp`（仅放行 upsert/ensure 写入，不放行 validate）。
- `validate` 会额外校验 `coverageSummary.evidence`；若声明了 `interactions/states/accessibility` 但仍是 TODO 占位，会判定失败。

## 人工校验清单（对照 `validate`）

- `completeness` 中每个维度都要在 `raw.json.coverageSummary.evidence` 中有非空证据数组。
- `source=figma-mcp` 且声明 `interactions/states/accessibility` 时，不允许保留 TODO 占位。
- `--allow-skeleton-with-figma-mcp` 仅允许先写骨架，未补齐 MCP 证据时 `validate` 必须失败。

## 防乱码约定（Windows / PowerShell）

为避免中文文档出现乱码，请统一遵循：

- 文本文件统一使用 UTF-8 编码（建议与仓库既有风格保持一致）
- Node 写文件必须显式指定 `utf8`
- PowerShell 写文件必须显式指定编码，例如：

```powershell
Set-Content -Path .\README.md -Value $text -Encoding utf8
Out-File -FilePath .\README.md -InputObject $text -Encoding utf8
```

- 不要把终端里已经乱码的内容直接复制回文件再保存
- 文档改动后，至少回读抽查 20 行，确认中文可读

---

## 维护者说明

维护本工具链源码时，请优先参考：

- 根目录 `CHANGELOG.md`
- `figma-cache/docs/README.md` 的维护说明

修改 `cursor-bootstrap/` 模板或 CLI 行为后，请按发布流程更新版本并发布，以便消费方通过 `cursor init` 获取最新模板。
