# SESSION 收尾 · 2026-04-28 深夜场（Round 3）

> 起点：v1.1-experiment-wave 已锁定 · 终点：observability 工程化 + 漏斗就位
> 本轮专注一条主线：把"看得到数据"从手工 IIFE 升级到工程化回归 + 真转化漏斗

---

## TL;DR

24 小时内三波节奏：
1. 上半场（白天）造 KA 化轮子（v1.0-ka-wave）
2. 中场（傍晚）押实验赌桌（v1.1-experiment-wave）
3. 这一波（深夜）把"假设要 metric → metric 要埋点 → 埋点要回归"补成完整链路

整夜的 9 个 commit 全在做一件事：让 5/5 拍版当天有真数据可看，而且数据接口本身有自动测试守门。

---

## 9 commit 主线（2332b85 ← d09d0ab）

| 哈希 | 阶段 | 主题 |
|---|---|---|
| d09d0ab | trackEvent v0 | 在 subject-hub.js 内联实现 + 2 个家长按钮埋点 |
| 6f56f44 | 文档同步 | OBSERVABILITY 写 dry-run 验证表 |
| 3090105 | 工程化 | 抽出 `observability-dry-run.cjs` + npm test 5 case |
| 8840a8c | 闭环 | OBSERVABILITY 末尾指 npm test 工作流 |
| f10e4a9 | 覆盖度 | hub 6 个按钮全埋（Up Next / 3 套打法 / 讲讲 / 复习 / 简报 / 图卡） |
| 7136e29 | 公共化 | 抽 `src/track.js` + index 9 学科 grid + What's New 7 卡点击 |
| 9474727 | 分母补齐 | track.js 加载即自动 page_view + 11 页全接 |
| 2332b85 | 漏斗 | OBSERVABILITY 三跳漏斗 snippet + dry-run case 8 |

事件覆盖度从 0 → 9 个 event name：
- 页面级：page_view
- 首页：home_subject_click / whatsnew_click
- hub 内 6 个：upnext_go_click / playbook_click / err_explain_click / err_review_click / parent_brief_copy_click / parent_card_share_click

---

## 三个工程化判断

### 1. 把"埋点测试"摆在跟产品代码一样的位置

之前 EXP 上线就上线，没有任何"如果有人改坏怎么办"的护栏。这次写 `npm test` 强制 8 case 通过才让 push 进 main——streak 算法 / 环形 buffer / groupby 计数 / 漏斗百分比都 hardcode 在 assert 里。任何把 streak 公式改坏的 commit 都会被退回。

### 2. 让"加一个埋点"成本 ≤ 1 行代码

`window.YDZX_TRACK.event(name, props)` 接口刻意做得跟 `console.log` 一样轻。任何人想加一个新埋点，只要在按钮 click handler 里加一句调用，无需配置 schema 无需 import 模块。低门槛是埋点覆盖广度的 prerequisite。

### 3. 转化率比单独计数更值钱

仅有 click 计数能告诉你"按钮被点了 50 次"，但不能告诉你"50 次是相对于多少 PV"。 page_view 自动登记 + 三跳漏斗 snippet 让 EXP-4 的 stop-loss 阈值从抽象「点击率 < 5%」变成具体的"step2→step3 转化率 < X% 即砍"。

---

## 当前观测点矩阵（5/5 standup 一眼看）

```
home → hub PV → hub action → end action
↓        ↓          ↓             ↓
9 学科   8 学科    6 类       (家长卡 share / 错题讲讲 等)
分桶     分桶     分桶         分桶
```

任意横切都可以从 `ydzx_event_log_v1` 直接出表，无需服务器。

---

## 明天（5/4 demo 当天）的最低限度

> 不是堆功能，是确认"什么都不改"也能跑：

1. 跑一次 `npm test` 8/8 绿
2. 跑一次根目录 `git log --oneline -1` 看到 main 上是 `2332b85` 或更新
3. demo 用浏览器进 home → 数学 hub → 答错刷错题 → 错题本攒 5 道 → 冲关 → 回 progress 看战利品 → 复制简报
4. 演示完之后 DevTools 跑 OBSERVABILITY 第 5 段 snippet（一键全跑）当场看 9 个事件分布

---

## 累计统计

整个 session 跨度（从 v1.0 起算）：
- 共 ~50 commit
- 2 个 release tag（v1.0-ka-wave / v1.1-experiment-wave）
- 4 个产品文档（KA-LOCALIZE-MILESTONE / EXPERIMENT-WEEK / OBSERVABILITY-MINIMAL / V1.0-TO-V1.1-DIFF）
- 3 个 SESSION-LOG（pm / round 2 / round 3 这份）
- 1 个 sunset 文档（EXP-1）
- 1 个 npm test 脚本（observability-dry-run.cjs · 8 case）
- 9 个事件埋点 + 11 页 PV 覆盖
- 4 个实验落地（EXP-2/3/4 + EXP-1 sunset）

---

## 反思一句话

整晚最后悔的是 trackEvent 一开始嵌在 subject-hub.js 里，到 7136e29 才抽出来变共享 module——浪费了 d09d0ab 到 f10e4a9 之间约 4 commit 的反复。下次写新基础设施先问"这东西多少页面会用"，>1 就直接抽到 src/。

---

> 下次再续一段，先 `git pull` 看 parallel session 是否仍在推 P1 系列。然后 `npm test` 确认 baseline 后再开新支线。
