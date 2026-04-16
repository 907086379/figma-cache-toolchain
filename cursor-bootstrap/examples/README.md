# 栈相关参考（不随 `cursor init` 复制）

本目录存放可选参考与模板文件：

| 文件 | 说明 |
|---|---|
| `vue2-vuetify2-adapter.reference.mdc` | 历史 Vue2 + Vuetify2 参考规则 |
| `generated-ui-reset.css.template` | 老项目 B0 局部 reset 模板（推荐默认） |

## B0 推荐用法（目标业务项目）
1. 复制模板到项目：`src/styles/generated-ui-reset.css`
2. 在入口（如 `src/main.ts`）引入一次
3. 生成组件根节点加 `generate-ui-reset`

说明：B0 仅做局部基线，不污染全局；B1/B2 见 `04-ui-baseline-governance.mdc`。