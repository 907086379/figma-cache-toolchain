# figma-to-code-pipeline 可行性与优化评估

## 1. 总体结论

`figma-to-code-pipeline` 当前可行性高，已具备在业务项目中落地的工程条件，定位清晰：
作为 **Figma -> 本地缓存 -> 校验门禁 -> 流程编排** 的中间层基础设施，不强绑定具体前端框架。

## 2. 已验证的可运行性证据

本地执行结果均通过：

- `pnpm -s run test:node`（包含 smoke）
- `pnpm -s run verify:static`（cursor shadow + docs encoding）
- `pnpm -s run verify:pack`（发布 files 覆盖校验）

这说明项目在「测试、静态校验、发布前检查」三条线上是可闭环的。

## 3. 可行性评估（按维度）

### 3.1 架构可行性：高

- CLI 主流程完整：`normalize/get/upsert/ensure/validate/stale/budget/backfill/flow/cursor init`
- 索引存储与节点目录结构明确，项目可复用性强
- `flow` 子命令支持关系沉淀（init/add-node/link/chain/mermaid）

### 3.2 工程可行性：高

- 有测试、有预检、有发布校验，且脚本命名规范化较好
- 有 changelog、文档总览、接入任务书，协作成本可控
- `cursor-bootstrap` 与 `.cursor` 镜像治理机制明确

### 3.3 业务落地可行性：高

- 强调“缓存优先 + 按需 MCP + 证据落盘 + validate 闭环”
- 对团队协作流程（同事指南、提示词、门禁）支持成熟
- 适合多项目、多人协同的稳定执行

## 4. 当前优势

- **证据链门禁强**：`source=figma-mcp` 时对 `mcp-raw` 做 manifest/hash/size/截断检查，能有效避免“假成功”
- **流程治理完整**：从 preflight 到 audit、validate、contract-check 有清晰串联
- **框架耦合低**：核心是数据层与流程层，迁移到不同前端栈成本低
- **发布质量意识好**：`verify:pack` 能提前拦截 npm 包白名单遗漏

## 5. 主要风险与约束

- **高风险**：CLI 入口文件职责偏重，命令分发与依赖注入集中，后续扩展容易冲突
- **中风险**：JSON + 同步文件 IO 在缓存规模变大后，存在并发与性能瓶颈
- **中风险**：URL 解析边界需继续扩展（例如 branch/board/make 场景）
- **中风险**：部分反骨架阈值较刚性，可能误伤合法的小节点场景
- **低风险**：Node 基线仍是 16.x，长期建议迁移到 18/20 LTS

## 6. 优化建议（分阶段）

### P0（1~2 周，优先做）

1. 拆分 CLI 入口：命令注册层 / handler 层解耦。
2. `index.json` 改为原子写入（临时文件 + rename）。
3. 校验阈值配置化（支持 per-node override）。

目标：先降低维护风险和误报成本，不改大架构。

### P1（2~4 周）

1. 完善 URL 解析矩阵（含边界样本）。
2. 增强回归测试集（针对 URL、证据缺失、flow 边关系）。
3. 引入可选存储后端（如 SQLite），保留 JSON 默认模式。

目标：提升规模化稳定性和兼容性。

### P2（4~8 周）

1. 逐步 TypeScript 化（先核心模块）。
2. 公开 schema（index/report/contract）并固化版本策略。
3. 做插件化扩展点（规则、门禁、适配器）。

目标：提升二次开发和长期演进能力。

## 7. P0 改造任务清单（可直接开工）

### 7.1 CLI 解耦（命令注册与执行分离）

- 新增目录：`figma-cache/js/commands/`
- 将 `figma-cache/figma-cache.js` 中的大段 `if (cmd === ...)` 迁移为独立命令处理器（例如 `normalize.js`、`get.js`、`ensure.js`、`validate.js`、`flow.js`）。
- 新增统一注册表（如 `figma-cache/js/commands/index.js`），通过 map 分发命令。
- 保留旧入口参数行为不变，确保外部脚本与 npm scripts 无感迁移。

验收标准：

- `figma-cache.js` 主文件规模显著缩小，主要保留依赖注入与调度。
- `pnpm -s run test:node` 全通过。
- `pnpm -s run fc:validate` 行为与改造前一致。

### 7.2 index 原子写入

- 修改文件：`figma-cache/js/index-store.js`
- `writeIndex` 从直接 `writeFileSync(INDEX_PATH)` 改为：
  1) 写入同目录临时文件（如 `index.json.tmp-<pid>-<ts>`）
  2) `fs.renameSync(tmp, INDEX_PATH)` 原子替换
- Windows 场景下处理 rename 异常与兜底清理策略。

验收标准：

- 异常中断后不出现半写入 JSON。
- 连续执行 `fc:upsert` / `fc:ensure` 不出现索引损坏。

### 7.3 校验阈值配置化

- 修改文件：`figma-cache/js/validate-cli.js`
- 将以下阈值参数集中抽象（支持 env + 配置文件覆盖）：
  - `FIGMA_MCP_MIN_DESIGN_CONTEXT_BYTES`
  - `FIGMA_MCP_MIN_DESIGN_CONTEXT_NODE_REFS`
  - `FIGMA_MCP_REQUIRE_DESIGN_CONTEXT_ASSETS`
- 增加可选 per-cacheKey 覆盖入口（建议先从项目 config 读取）。

验收标准：

- 默认行为保持不变。
- 可针对特殊小节点降低误报，且不影响其他节点门禁强度。

### 7.4 P0 回归清单

每完成一项执行：

- `pnpm -s run test:node`
- `pnpm -s run verify:static`
- `pnpm -s run verify:pack`
- 手工冒烟：
  - `fc:init`
  - `fc:ensure <figma-url>`
  - `fc:validate`
  - `fc:flow:init` + `fc:flow:add-node`

## 8. 最终判断

如果目标是：

- 让 Figma 数据接入流程可追踪、可审计、可复盘；
- 降低多人协作下“口径漂移”和“证据缺失”风险；
- 在不锁定框架的前提下建立稳定中间层；

那么这个项目值得继续投入并落地。建议按 **P0 -> P1 -> P2** 推进，其中 P0 可立即执行。
