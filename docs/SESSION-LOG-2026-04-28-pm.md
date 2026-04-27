# SESSION 收尾 · 2026-04-28 下半场

> 起点：v1.0-ka-wave 收口 · 终点：实验排期表落地 + 4 个 EXP 上线
> 本文档目的：明天的自己 / 团队成员 / 未来引用 30 秒续上工作

---

## TL;DR

下半场围绕 v1.0 之后的 v1.1 实验赌桌做了 11 个 commit，核心动作三块：

1. **里程碑收口**：v1.0-ka-wave tag、KA-LOCALIZE-MILESTONE-v1.md、根目录 README、首页 What's New 横滑带
2. **实验排期文档化**：EXPERIMENT-WEEK-v1.1.md 把 6 个候选改进拆成 A/B-able 假设清单
3. **实验落地**：EXP-2 月度 delta / EXP-3 跨周 streak / EXP-4 家长图卡 三个 P0/P1 全部 shipped；EXP-1 英语 manifest 走 sunset

---

## 今日 commit 时序

| 哈希 | 主题 | 类别 |
|---|---|---|
| 3acd110 | KA-LOCALIZE 里程碑 v1 docs | 收口 |
| 3fe2c5c | quiz 按钮 hover tooltip + about footer milestone 链 | polish |
| cfab40a | 首页 What's New 横滑 7 卡带 | 收口 |
| 92c6acc | README.md 5 徽章 + 演示动线 | 收口 |
| 96bcd24 | EXPERIMENT-WEEK-v1.1.md 6 EXP 拆解 | 文档 |
| ab92658 | EXP-2 mastery 月度 delta 上线 | shipped |
| 86f83fd | EXP-1 英语 manifest 走 sunset | sunset |
| 038254b | EXP-3 跨周冲关 streak chip + 徽章 | shipped |
| 673a065 | EXP-4 家长简报图卡按钮 | shipped |
| 806fde0 | EXPERIMENT-WEEK 同日更新（状态板 + W1 checklist） | 文档 |

11 个 commit，约 6h 自驱周期。

---

## 三个判断回顾

### 1. 调研 → 砍掉 → 不纠缠（EXP-1）

预设：英语 manifest 补 4 本，拉 home → 学科页转化率。
真相：2 本英语在 `scans` 不在 `books`，是 image-only PDF，需 OCR pipeline。
结果：写 sunset 文档定档 blocker，placeholder 文案降级为「PDF 已收 · 正文 OCR 中」，让出 6h 给 EXP-3/4。

教训：实验前 30 分钟调研抵消 6h 错误投入。下次任何实验起步前先 grep 数据。

### 2. 反 dopamine 的工程化（EXP-2 / quiz 连对）

EXP-2 的 mastery delta 故意吃掉负值（不显示退步），quiz 顶部 10 连对推 "今天可以收工"。两个动作都反传统的"用 metric 推用户继续刷"。判定：中国家长场景下，避免负反馈伤动机比"残忍透明"更优；连击狂热是反 retention 的（隔天用户带着挫败感不来）。

### 3. 文档先行，代码后行（EXPERIMENT-WEEK）

之前几次 P0 实验都是写完代码再补文档。这次反过来：先写 6 EXP 假设/指标/止损，再做实验，文档就是 todo list。意外好处：写假设时被迫诚实，发现 EXP-5/6 是直觉押注没数据支撑，自动排到 W3+，省了凑数 commit。

---

## 当前在线状态（5/5 拍版用）

- v1.0-ka-wave tag：8 学科枢纽 / 错题冲关 / 战利品墙 / 家长视图 / 时段打法
- v1.1 进行中实验：
    - EXP-2 mastery 月度 delta（5/5 看 7 日二访）
    - EXP-3 跨周 streak 徽章（5/12 看 streak_4 触发量）
    - EXP-4 家长图卡（5/5 看点击率 + utm 注册）
- 排队：EXP-5 章节考点细分（W3）、EXP-6 移动 tab bar（W3+）
- Sunset：EXP-1 英语（等 OCR）

---

## 明天的自己 · 第一件事

1. `git pull origin main` 拉远端（防有别的 session 推过 docs）
2. 打开 `docs/EXPERIMENT-WEEK-v1.1.md` 看 W1 checklist
3. 抽 30 个用户的 `localStorage.ydzx_mastery_snapshots_v1` + `ydzx_challenge_clears_v1` 看真实数据形态
4. 5/4 之前完成 3 家长 + 3 学生定性访谈

---

## 反思一句话

「写文档比写代码更省工程时间」——本轮 EXPERIMENT-WEEK 倒逼放弃 2 个 P2 直觉项目，省了 ~16h；EXP-1 sunset 早 30 分钟做调研省了 6h。下次新方向先写 1 页假设。
