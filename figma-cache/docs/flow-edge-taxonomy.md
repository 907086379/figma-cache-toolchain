# Flow 边类型约定（单人迭代版）

用于 `flows[].edges[].type` 字段。优先少而精，后续可扩展。

## 主路径

- `next_step`：主流程下一步（同模块线性推进）
- `next_page`：跨页面/跨大区块的下一步（仍属主路径）

## 弱关联

- `related`：同迭代相关，但不确定先后或类型（占位，后续可升级）

## 分支

- `branch_true`：条件成立分支
- `branch_false`：条件不成立分支
- `branch_default`：默认分支

## 结构关系

- `child`：UI 结构父子（例如弹层属于某屏）
- `variant`：同一节点的不同状态变体（A 与 A-error）

## 逆向/回退

- `back`：返回上一步
- `cancel`：取消/关闭导致回到某节点

## 备注

- 不确定时先用 `related`，不要硬编 `next_step`。
- 边上可用 `note` 写人话解释（例如“号码校验失败出现警告条”）。
