# 小程序闭环与竞品对照审计

日期：2026-05-24

## 结论

当前最值得推进的不是继续加大功能，而是把已有能力做成稳定闭环：上传材料、生成标准家长 HTML 报告、给出下一步、进入私教/复习/游戏、回流证据、家长确认、再导出 PDF。

## 关键闭环现状

| 闭环 | 当前代码承接 | 对标竞品能力 | 增进方向 |
| --- | --- | --- | --- |
| AI 私教 | `tutor`、`tutor-ladder`、报告 CTA 已能回到第一步追问 | Khanmigo 的苏格拉底式引导和不给答案 | 报告页必须继续强调“先第一步、后答案”，不要把方法建议写成营销跳转 |
| 小课堂补位 | `openMaicDecisionBridge` / `miniLessonReport` 已能把材料转成小课堂上下文 | Khanmigo 的概念误区识别 | 只在真实卡点出现时触发，不做泛知识讲解 |
| 回忆复习 | `review`、`review-cards`、`recordReportRevisitEvidence` 已能回流证据 | Synthesis/Alpha 的高频反馈 | 每次复习必须回写“是否说出第一步、是否隔天还会” |
| 游戏化 | `arcade`、`game-logic` 已有 XP、回忆挑战、回流规则 | Synthesis 的游戏化参与感 | 游戏只做真实错因后的轻练习，不开放刷题式奖励 |
| 家长报告 | `learning-report`、`profile`、`upload` 已有标准版 HTML 报告元信息和导出规则 | 竞品普遍弱在家长解释链路 | 继续把“天赋/材料 -> 方法匹配 -> 验证动作”放在产品入口前面 |
| PDF/HTML | HTML 已可打印，导出策略已写入标准 | 报告型产品的交付感 | 小程序内展示摘要，完整 PDF 走 H5 WebView 或服务端临时文件 |

## 上线操作路径

1. 在 `ai-edu-platform` 继续开发和验证。
2. 运行 `scripts/verify.ps1`，本地允许 upload gate 因真实 AppID 缺失而非致命阻塞。
3. 用 `npm.cmd run miniapp:sync:aiedumini -- --dry-run` 确认同步范围。
4. 需要正式推送时，再运行 `npm.cmd run miniapp:sync:aiedumini -- --commit`。
5. 在 `aiedumini` 确认 diff、验证、提交和推送。
6. 拿到真实微信 AppID 后运行 `npm run miniapp:appid -- wx你的AppID`，再用微信开发者工具导入 `miniprogram/` 上传体验版。

## 当前剩余风险

- 真实 AppID 仍是外部阻塞，不影响本地功能验证，但影响上传/提审。
- 小程序端不能承诺直接解析任意 PDF 或一键下载 PDF；完整导出要走 H5/服务端。
- 当前仓库有大量既有未提交修改，后续同步或提交前必须按文件范围审查，不要 broad reset。
- 竞品对照已经进入报告标准字段，但还需要真实用户上传材料后的实机走查，确认家长端不会显得信息过载。
