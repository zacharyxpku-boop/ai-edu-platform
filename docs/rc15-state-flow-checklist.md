# RC1.5 真机状态流验收清单

本轮只验收本地状态流，不做 UI 重构，不新增功能。目标链路：

输入卡点 -> 生成 todayFocus -> 进入错题闭环 -> 输入 miniActionText -> 完成修复 -> 生成 reviewCard -> 知识游乐场读取回访卡 -> 我的页读取 miniActionText 并生成家长只问一句。

## 开始前

1. 在微信开发者工具导入 `miniprogram/`。
2. 打开 Storage 面板，准备观察本地缓存。
3. 清空本地学习状态：
   - 推荐方式：微信开发者工具右上角 `清缓存` -> `清除数据缓存`，然后重新编译。
   - 或在 Storage 面板删除学习相关 key 后重新编译。
4. 验收时重点查看这些 Storage 项：
   - `ydzx.companion.preference.v1`
   - `ydzx.today.focus.v1`
   - `ydzx.review.cards.v1`
   - `ydzx.review.events.v1`
   - `ydzx.tonight.plan.v1`

## 关键字段

在 Storage 面板中，重点确认：

- `sourceText`：孩子输入原话。
- `issueType`：中文卡点类型，不应是内部 enum。
- `title`：具体卡点标题。
- `miniActionText`：孩子说出的第一步。
- `miniActionAt`：保存第一步证据的时间。
- `repairStatus`：修复状态。
- `progress`：完成后应为 `100`。
- `completed_at`：完成修复时间。
- `front`：回访卡正面。
- `backPrompt`：回访卡背面提示。

## 路径 A：步骤断点

1. 清空本地学习状态。
2. 进入作业点拨。
3. 输入：
   `我写到第二步就乱了。`
4. 确认生成 `todayFocus`：
   - `sourceText` 包含原话。
   - `issueType = 步骤断点`。
   - `title` 包含“第二步”或“写到第二步”。
5. 进入错题闭环。
6. 点击“开始 5 分钟修复”。
7. 不输入 `miniActionText`，直接尝试完成。
8. 确认不能 completed，并提示：
   `先用自己的话说一句第一步，再完成修复。`
9. 输入 `miniActionText`：
   `我先找题目问什么。`
10. 再完成修复。
11. 确认：
   - `repairStatus = completed`
   - `progress = 100`
   - `miniActionText` 已保存
   - `miniActionAt` 已保存
   - `completed_at` 已保存
12. 进入知识游乐场。
13. 确认 `reviewCard.front` 引用 `todayFocus.title` 或 `miniActionText`，不是固定句。
14. 进入我的页。
15. 确认显示：
   `孩子说出的第一步：我先找题目问什么。`
16. 确认“家长只问一句”围绕 `miniActionText` 生成。

## 路径 B：列式关系

输入：

`我不确定单位1是谁。`

确认：

- `issueType = 列式关系`
- `title` 包含“单位1”
- `reviewCard.front` 能引用“单位1”或 `miniActionText`
- 我的页家长问题不是泛泛的“第一步找什么”，而是更贴近“单位1”或孩子说出的第一步

## 路径 C：读题审题

输入：

`题目条件太多，我不知道怎么用。`

确认：

- `issueType` 不为空
- `sourceText` 保存原话
- `title` 包含“条件太多”或“条件不知道怎么用”
- `reviewCard.backPrompt` 提醒先看问题，再找相关条件

## 路径 D：无效 miniActionText 拦截

分别输入以下 `miniActionText`，确认不能 completed：

- `不知道`
- `不会`
- `随便`
- `求答案`
- `直接看答案`

预期：

- `repairStatus` 保持 `in_progress`
- `hasMiniActionDone = false`
- `blockedReason = mini_action_required`
- 页面提示：`先用自己的话说一句第一步，再完成修复。`

## 通过标准

- 明显卡点能生成 `todayFocus`。
- 无效或缺失 `miniActionText` 不能完成修复。
- 有效 `miniActionText` 能保存，并允许完成修复。
- 完成修复后生成 `today_focus` 来源的 `reviewCard`。
- 知识游乐场能读到刚生成的 `today_focus` 回访卡。
- 我的页能读取同一个 `miniActionText`，并生成家长只问一句。
- 用户可见区域不出现内部 key、拍照出答案类文案或 dashboard 文案。
