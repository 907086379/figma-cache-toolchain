# figma-cache-toolchain：团队使用说明（可转发）

本文面向**业务仓库**里要用 Figma 本地缓存的同事：说明**是什么、何时用、怎么接、日常怎么用、怎么升级**。技术细节仍以包内**根 `README.md`**、**`figma-cache/docs/README.md`** 为准；链接与键、Flow 边类型分别见 **`link-normalization-spec.md`**、**`flow-edge-taxonomy.md`**。**专用名词**见**文首「术语与专用名词（速查）」**表格。

---

## 术语与专用名词（速查）

读后续提示词前，可先扫一眼本表。**路径**均相对业务项目根，默认缓存目录名为 **`figma-cache/`**（可用环境变量 **`FIGMA_CACHE_DIR`** 改掉）。

| 名词 | 一句话解释 |
|------|------------|
| **`ensure`** | 针对一条 Figma 链接：在 **`figma-cache/index.json`** 里登记/更新一条 **`items`** 记录，并在磁盘上生成/补齐该节点的 **`meta.json` / `spec.md` / `raw.json` / `state-map.md`** 等骨架；常由 Agent 调用 CLI `figma-cache ensure` 完成。**它不是自动 MCP 拉取器**，MCP 原始回包应先由 Agent 调 figma-mcp 写入 `mcp-raw/`，再 `upsert/ensure`。 |
| **`get`** | 按链接查看缓存是否命中、或拉取条目信息；不一定写盘。 |
| **`validate`** | 检查 **`index.json`** 结构是否合法（必填字段、`flows` 里的边是否指向存在的 `items` 等）。合并前可跑。 |
| **`completeness`** | `ensure` 时可传的**标签列表**（如 `layout`、`text`、`tokens`、`interactions`），表示「希望这次把哪些方面的设计信息写进缓存/交给 MCP」。**不是 Figma 官方枚举**，而是你们流程里约定「要记多细」；具体写入内容仍落在 **`spec.md` / `raw.json`** 等文件里。 |
| **`spec.md`** | 某节点目录下的 **Markdown**，人类可读的设计摘要/规格说明，**对齐 UI、走查像素时最常对照**的文件之一。 |
| **`meta.json`** | 同目录下的 **JSON**，记录该缓存项的元信息（如 `fileKey`、`nodeId`、`syncedAt`、`source` 等），偏「这条缓存是谁、何时写的」。 |
| **`raw.json`** | 同目录下的 **JSON**，偏**结构化原始快照**（可能较大），适合机器读或 Agent 从中抽字段；**像素/间距等细节**以团队约定为准，常见与 **`spec.md`** 一起看。 |
| **`state-map.md`** | 占位/扩展用 Markdown，用于**状态机、屏间跳转、交互说明**等；初始可能是 TODO，由你们或 Agent 补全。 |
| **`index.json`** | 缓存库的**总索引**：里面有所有节点的 **`items`**，以及可选的多屏流程 **`flows`**。 |
| **`items` / 一条 item** | `index.json` 里 **`items`** 对象：键为 **`cacheKey`**，值为该 Figma 节点（或整文件）的索引记录（含 `url`、`paths`、`completeness` 等）。**「进缓存」≈ 有一条 item。** |
| **`cacheKey`** | 标准化后的**唯一键**，一般形如 **`fileKey#nodeId`**（无节点时可能是 **`fileKey#__FILE__`**）。用于去重、校验、`flow` 里引用节点。算法见 **`link-normalization-spec.md`**。 |
| **`fileKey` / `nodeId`** | **fileKey**：Figma 文件 ID。**nodeId**：画布上某个节点的 ID（常为 `数字:数字`）。都来自链接解析。 |
| **`flow`（流程）** | 在 **`index.json` 的 `flows`** 里的一条记录，表示**一条业务用户路径**（多屏/多节点），含 **`flowId`**、节点列表、**边（edges）** 等。与「单条 Figma 链接」不同：**flow 描述的是关系与顺序**。 |
| **`flowId`** | 某条流程的 ID 字符串（如 `my-onboarding-flow`），`flow init` 时创建；后续 **`flow add-node` / `flow link`** 都要指明落在哪条 flow 上。可用 **`FIGMA_DEFAULT_FLOW`** 省略重复参数。 |
| **`flow link` / `flow chain`** | CLI 子命令：在指定 **`flowId`** 下**加边**（从屏 A 到屏 B、类型 `next_step` 等），或**按顺序一串链式连接**多个 URL。 |
| **`flow mermaid` / `flow show`** | 把当前 flow **导出成 Mermaid 图**或 **JSON 文本**，方便贴进文档或评审。 |
| **边类型（`type`）** | `flow link` 时的 **`--type=`**，如 `next_step`、`related`、`child`、`branch_true` 等；**完整列表与语义**见 **`flow-edge-taxonomy.md`**。 |
| **`note`** | 可选：附在边上的一句**人话说明**（如「点击设置进入」），方便以后读 `index.json` 或导出图时理解。 |
| **MCP / `figma-mcp`** | **Figma MCP**：在 Cursor 里从 Figma **实时读**画布/节点信息的通道。缓存**优先**；本地不够或你要最新稿时，再由 Agent 调 MCP。 |
| **Core 规则** | 通常指 **`.cursor/rules/01-figma-cache-core.mdc`**：只管**数据层**（标准化链接、读写 `figma-cache`、何时 MCP、校验），**不写** Vue/React 具体代码。 |
| **Adapter** | 通常指 **`.cursor/rules/02-figma-<栈>-adapter.mdc`**：约定**在缓存可读之后**，如何在你司技术栈里写业务 UI。 |
| **Skill** | **`.cursor/skills/figma-mcp-local-cache/SKILL.md`**：教 Agent **何时查缓存、何时调 MCP、如何跑 CLI** 的步骤化说明，与 Core / Adapter 配合使用。 |
| **`AGENT-SETUP-PROMPT.md`** | 项目根下的 **Agent 任务书**（`cursor init` 每次刷新）：用于**一次性接入**栈配置、合并 `figma-cache.config.js`、补 npm scripts 等。 |
| **`postEnsure`** | **`figma-cache.config.js`** 里的钩子：**每次 `ensure` 写完通用骨架文件之后**调用一次，可写适配说明、维护 **`docs/figma-flow-readme.md`** 等；**抛错不会让整个 ensure 失败**（由 Core 捕获日志）。 |
| **`cursor init` vs `figma-cache init`** | **`cursor init`**：拷 `.cursor` 模板、刷新 **`AGENT-SETUP-PROMPT.md`**、同步 **`colleague-guide-zh.md`**。**`figma-cache init`**：只建 **`figma-cache/index.json`** 空索引，**不管 Cursor**。 |
| **`npm run figma:cache:*`** | 项目在 **`package.json` 的 `scripts`** 里封装的 CLI；未配置时可用 **`npx figma-cache <子命令>`** 代替。 |
| **`tokenProxyBytes`** | 预算统计字段：用 `mcp-raw-get-design-context.txt` 的文件大小做 token 代理估算（用于成本趋势，不等于模型精确 token）。兼容字段 `tokenProxyChars` 仅用于平滑迁移。 |
| **业务流程文档（推荐）** | 通常指项目里的 **`docs/figma-flow-readme.md`**（路径可改）：用**中文叙事**写清主路径/分支/边界，并粘贴 **`flow mermaid`**；与 **`index.json` 的 `flows`** 双轨对齐，**人和 Agent 都优先读它建立上下文**。详见 **§5.8～§5.10**。 |

---

## 1. 这个包是干什么的

- **把 Figma 链接变成项目里可复用的本地缓存**（`figma-cache/index.json` + `figma-cache/files/...`），并带 **Node CLI** 做标准化、写入、校验。
- **不绑定** Vue/React 等具体 UI；你们项目里的 **Cursor 规则 + `figma-cache.config.js`** 会约定「缓存好之后代码怎么对齐设计」。
- **日常多数时候**：把 Figma 链接丢给 **Cursor Agent**，由 Agent 按规则走「先查本地缓存 → 不够再 MCP → 回写 → 校验」即可；**不必**每人背命令。

---

## 2. 适用场景（什么时候有用）

| 场景 | 说明 |
|------|------|
| **单屏 / 单组件对齐** | 只有一条 Figma 链接，要把布局、文案、状态写进代码。 |
| **多屏 / 多节点同一业务流** | 登录 → 首页 → 设置等多条链接，希望在缓存里保留**先后或分支关系**，便于迭代与评审。 |
| **渐进式补设计** | 今天先拉一条链接进缓存，过几天再给下一条，并要求**关联到之前某屏**（下一屏、弹层挂在某屏上、分支等）。 |
| 多人协作同一套设计稿 | 减少重复拉 Figma、口径统一（以本地缓存 + 校验为准）。 |
| 希望对话可复现、可审计 | 设计事实落在仓库的 `figma-cache/`（是否提交 git 由团队约定）。 |
| 用 Cursor 做设计落地 | 配合 `.cursor` 规则与 Skill，Agent 行为一致。 |

若项目**从未**装过本包，需要有人做一次**接入**（第 3 节）。

**和「提示词」的关系**：下面第 5 节给的句子是**自然语言指令**；Agent 在 **Core 规则**下会优先读本地 `figma-cache/`，不足再走 Figma MCP，并调用 **`npm run figma:cache:*` / `npx figma-cache`** 维护索引。你**不需要**自己敲 CLI，但**说清楚意图与关系**，结果会稳定很多。

---

## 3. 一次性接入（业务项目根目录执行）

顺序建议固定为下面 **4 步**，避免和「只刷新 Cursor 模板」混淆。

### 步骤 1：安装依赖

```bash
npm i -D figma-cache-toolchain
```

### 步骤 2：写入 Cursor 模板并刷新任务书

```bash
npx figma-cache cursor init
```

作用：在项目里生成/更新 **`.cursor/`**、`figma-cache.config.js`（并在安全场景清理 legacy 的 `figma-cache.config.example.js`），并**每次刷新**根目录的 **`AGENT-SETUP-PROMPT.md`**。  
**注意**：这一步**还不会**创建业务用的 **`figma-cache/index.json`**。

### 步骤 3：在 Cursor 里交给 Agent 执行一次

在 Cursor 对话中输入 **`@AGENT-SETUP-PROMPT.md`**，并说「**按该文档执行**」。  
Agent 会按你们仓库栈生成/合并 **`figma-cache.config.js`**、栈专属 Adapter、补全 **`figma:cache:*` npm scripts** 等（**每个项目通常只需成功做一次**；以后升级包见第 7 节）。

### 步骤 4：初始化本地缓存目录（空索引）

在 **步骤 3 完成之后**执行（有 script 优先用 script）：

```bash
npm run figma:cache:init
```

若尚未有对应 script：

```bash
npx figma-cache init
```

成功后，项目根会出现 **`figma-cache/`** 目录及 **`figma-cache/index.json`**（开始时可能只有索引，**没有**具体节点文件是正常的）。

**易混点**：**`cursor init`**（步骤 2）≠ **`figma-cache init`**（步骤 4）；前者管 Cursor 模板，后者管**本地缓存数据骨架**。

---

## 4. 同事日常怎么用（接入完成之后）

1. **有 Figma 相关需求时**：在 Cursor 里把 **Figma 链接**和任务说明发给 Agent；Agent 会按项目里的 **Core 规则 + 你们栈 Adapter + Skill** 处理缓存与落地边界。  
2. **需要自检时**（例如合并前、怀疑索引坏了）：

   ```bash
   npm run figma:cache:validate
   ```

   或：

   ```bash
   npx figma-cache validate
   ```

3. **规范文档在哪**：包内自带说明（安装后在 **`node_modules/figma-cache-toolchain/figma-cache/`** 下的多个 `.md`）。一般**不必**再复制一份到业务仓库；需要时让 Agent **`@` 该路径**即可。
4. **看预算**（可选）：`npm run figma:cache:budget`，快速看 MCP 调用与 `tokenProxyBytes`。

---

## 5. 团队统一提示词（只保留一个主模板）

为了避免“模板太多不好选”，这里统一成 **1 个最推荐提示词**。  
默认先复制这一段，再按需要补 1~2 句附加要求。

### 5.1 最推荐主提示词（默认用这个）

```text
请按项目 figma 缓存规则处理下面这条 Figma 链接，并遵循“缓存优先 + 按需 MCP + 最小调用集”：
1) 先查本地 figma-cache，命中则直接复用，不做刷新；
2) 仅在未命中或我明确要求刷新时，才调用 figma-mcp 拉取并写入 mcp-raw（随后再 ensure/upsert）；
3) completeness 默认使用 layout,text,tokens,interactions,states,accessibility（若任务需要再补 flow/assets）；
4) 原始 MCP 数据统一保存到节点目录 mcp-raw/ 子目录；
5) 默认不保存 whoami 原始文件（仅鉴权排障或我明确要求时保存）；
6) 完成后执行 figma:cache:validate，并汇报：缓存状态、实际 MCP 调用次数、输出文件清单。

[Figma 链接]
```

### 5.2 仅在需要时追加的附加句（可选）

- 要强制最新：`忽略本地缓存，强制刷新，以 Figma 最新为准。`
- 要 React 直复用：`若目标项目是 React 栈，优先复用 mcp-raw-get-design-context.txt 的 React 代码，只做必要微调。`
- 要补流程关系：`请在 flow [flowId] 下补齐节点关系（link/chain），并输出 mermaid。`

### 5.3 使用建议（团队口径）

- 日常协作默认只用 **5.1 主提示词**。
- 只有确实需要时，再从 5.2 里加一句附加要求。
- 新同事只记住一条：**先缓存、后实现；能复用本地就不重复调 MCP**。

---

## 6. 仓库里建议提交什么（和团队对齐即可）

常见做法（**以你们团队约定为准**）：

- **建议提交**：`.cursor/`（若团队希望共享同一套 Agent 行为）、`figma-cache.config.js`、`AGENT-SETUP-PROMPT.md`（会随 `cursor init` 刷新）、`package.json` / lock。  
- **按需提交**：`figma-cache/index.json` 与 **`figma-cache/files/`**（若希望「拉过即入库」、CI 可校验）；若采用默认 **`postEnsure`**，还可提交 **`docs/figma-flow-readme.md`**（或你在 `FIGMA_CACHE_FLOW_README` 中自定义的路径）供评审与新人阅读。  
- **可不提交**：纯个人试验缓存（则同事本地需自行 `ensure`）。

---

## 7. 升级 npm 包之后怎么做

```bash
npm i -D figma-cache-toolchain@latest
npx figma-cache cursor init
```

- **`AGENT-SETUP-PROMPT.md`** 每次 `cursor init` 都会刷新，便于看到新版说明。  
- 若你们**已经完成过**步骤 3，**不必**为升级而完整重跑一遍 Agent；除非任务书里有你们需要合并的新要求。  
- **已有** `figma-cache/index.json` 时，**一般不必**重复执行 `figma:cache:init`。

---

## 8. 排障与谁维护

- 命令帮助：`npx figma-cache`（无子命令时通常会打印用法）。  
- 配置预览：`npm run figma:cache:config`（若已配置 script）。  
- **维护责任人**：建议在团队 README 或内部 wiki 里写一句「谁负责升级 `figma-cache-toolchain`、谁审批 `.cursor` 规则变更」。

---

## 9. 本文档位置（方便你转发）

- **业务项目（推荐）**：在仓库根执行 **`npx figma-cache cursor init`** 后，本说明会**自动写入或刷新**到 **`figma-cache/docs/colleague-guide-zh.md`**（与 `FIGMA_CACHE_DIR` 一致，默认目录名 `figma-cache/`）。同事 **`@figma-cache/docs/colleague-guide-zh.md`** 即可，**不必**从 `node_modules` 手抄。每次升级包后再跑一次 `cursor init` 即可同步正文。
- **包内原件**：`node_modules/figma-cache-toolchain/figma-cache/docs/colleague-guide-zh.md`（与上者内容一致，发版随包附带）。
- **维护工具链源码的仓库**：同路径 **`figma-cache/docs/colleague-guide-zh.md`**。

将本文件全文复制到 IM / 邮件 / 内部文档即可给同事使用。




