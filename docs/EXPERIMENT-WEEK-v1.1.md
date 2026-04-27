# 实验品周 v1.1 · 6 个候选改进的 A/B-able 拆解

> 起笔日：2026-04-28
> 适用周期：v1.0-ka-wave 之后 7-14 天
> 用法：每个实验都按 hypothesis → metric → stop-loss 三段写。如果某项 stop-loss 触发，立即砍掉该方向，不要纠缠。

---

## 总体心法

不再做"先全做完再上线"。每个实验配 1 周硬窗口，到点不达标砍掉。
按预期 ROI × 落地难度排序，优先做 P0 两项；P1 排队；P2 仅当 P0 全跑通才起。

---

## EXP-1 · 英语 manifest 补全（P0）

**Hypothesis**: 9 学科 grid 的英语 placeholder 是高频"为啥不能用"反馈来源；补 4 本人教版英语教材进 manifest，可拉高 home → 学科页转化率。

**实施**:
- 找人教版英语必修 1-3 + 选修 PDF（或独立 OCR pipeline）
- 跑 fitz 抽章节 → 写 manifest.books 数组 4 条
- index.html 移除英语「建设中」灰态，9 学科全亮

**Metric**:
- 主指标：home 9 学科 grid 上"英语"卡的点击率 / 总点击率
- 次：英语学科页 mastery 圆环非 0% 用户数

**Stop-loss**:
- 一周后英语点击率 < 数学 50%（用户对英语课无感） → 该项不做下一步深挖，placeholder 退回
- 教材抽章失败率 > 20% → manifest 不进，回退占位

**预算**: ~6h（OCR pipeline 复用 ChinaTextbook 已有逻辑）

---

## EXP-2 · 学科 hub mastery 圆环加月度对比（P0）

**Hypothesis**: 单一静态百分比不能让学生感知"在进步"，加上「比上月 +X%」对比可创造正向 momentum 错觉，提升 7 日留存。

**实施**:
- 在 `localStorage.ydzx_textbook_read` 上叠一个 month-snapshot 写入（每月 1 日凌晨自动 snapshot 当前 mastery）
- 圆环下方加一行小字：「比上月 +5%」（绿）/「平」（灰）/「-2%」（红）
- 红色不显示，避免负反馈伤动机

**Metric**:
- 主：学科页 7 日二访率（同一 yd:my_student_id 7 天内回访同学科页比例）
- 次：mastery 圆环停留时间（heatmap）

**Stop-loss**:
- 一周后 7 日二访率不升反降 → 撤销
- snapshot 在跨设备场景丢失率 > 30% → 改 server-side 才做

**预算**: ~3h

---

## EXP-3 · 跨学科冲关 streak 徽章（P1）

**Hypothesis**: 单关 +20 XP 一次性激励太短；连续 4 周通关 ≥1 关解锁"4 周不间断"金徽章可提升 28 日留存。

**实施**:
- 给 `ydzx_challenge_clears_v1` 增加 weekly aggregator
- gamification.BADGES 注册 challenge_streak_4 / challenge_streak_8 / challenge_streak_12
- 战利品墙顶部出现 streak chip：🔥 已连续 X 周通关

**Metric**:
- 主：连续 ≥4 周冲关用户数 / 至少冲关 1 次的用户数（转化率）
- 次：4 周窗口内单用户日均冲关次数

**Stop-loss**:
- 单周冲关人数 < 10 → 数据不够支持 streak 机制，先扩冲关入口再考虑
- 4 周后没人触发 streak_4 徽章 → 阈值过高，下调到 streak_2

**预算**: ~4h

---

## EXP-4 · 家长简报每周自动图卡（P1）

**Hypothesis**: 文本简报粘贴微信效果不直观，自动生成一张 4:3 图卡可拉高家长群转发率，进而带新用户注册。

**实施**:
- 复用 share-kit 的 html2canvas 模板
- 学科页家长卡加「📤 周日生成图卡」按钮
- 图卡: 学生姓名 + 学科 + 4 档状态 + 三行核心数据 + 二维码回原点首页

**Metric**:
- 主：家长卡按钮点击 / 学科页 PV
- 次：通过 utm_source=parent-card 来源的 welcome 注册数

**Stop-loss**:
- 点击率 < 5% → 家长不在意可视化，撤
- 来源注册 < 3 / 周 → 转发链路不通，撤

**预算**: ~5h（html2canvas 已熟）

---

## EXP-5 · 章节考点细分到「概念 / 应用 / 综合」三档（P2）

**Hypothesis**: 当前章节 mastery 只有 4 阶（未碰 / 读 / 练 / 掌握），细化到题型维度可让 AI 私教更精准定位卡点，从而提升 quiz 二答正确率。

**实施**:
- seed-questions-generated.json 新增 type 字段（concept / apply / synthesis）
- 学科页 hero 圆环旁加 3 个 mini-bar
- AI 私教 prompt 注入"该学生在 X 章 概念档 mastery 60% / 应用档 30% / 综合档 0%"

**Metric**:
- 主：quiz 二答（同 ID 第 2 次出现）正确率提升幅度
- 次：AI 私教对话首轮命中率（学生评分 ✓）

**Stop-loss**:
- 二答正确率提升 < 5pp → 收益不抵复杂度成本，撤
- type 标签错误率 > 15%（人工抽样） → 不做

**预算**: ~10h（三个学科手工标 200 道题再扩展）

---

## EXP-6 · 移动端底部 tab bar（P2）

**Hypothesis**: 当 mobile UA 占比 > 60% 时，顶部 sticky nav 太远；底部 tab bar（首页 / 学习 / 错题 / 我的）可降低跨页切换成本。

**实施**:
- 检测 UA + 视口宽度 < 768px → mount fixed bottom nav
- 4 个 tab 与 现有 sticky nav 二选一显示
- 顺带把 nav 路由统一收口到 `/src/nav-config.js`

**Metric**:
- 主：mobile 用户跨页 PV/session（vs 桌面用户）
- 次：mobile 用户 7 日留存

**Stop-loss**:
- mobile UA < 40% → 桌面仍是主战场，不投入
- 上线后 mobile 跨页 PV 反降 → 双 nav 干扰，回退

**预算**: ~6h

---

## 排期

| 周 | P0 实验 | P1 实验 | 备注 |
|---|---|---|---|
| W1 | EXP-1 + EXP-2 并行 | — | EXP-2 需 5 天数据才能判 |
| W2 | 看 EXP-1/2 结果决定砍留 | EXP-3 起步 | EXP-2 已观察一轮 |
| W3 | — | EXP-4 起步 | 周日要图卡所以必须周三前 ship |
| W4 | — | EXP-3/4 收尾 | 决定 EXP-5/6 是否启动 |

---

## 决策原则

- **不要同时跑 ≥3 个 P0 实验**：metric 互相污染
- **每个实验独立 utm_source / event_name**：埋点先行
- **stop-loss 触发立即砍**：不要"再观察一周"
- **人工抽样 > 数据 > 直觉**：每个实验上线前抽 10 个真用户做用户访谈
- **失败实验也写一份 sunset 文档**：放在 `docs/sunset/` 累积避坑库

---

> 这份文档不是路线图，是赌桌。
> 每个 EXP 都有可能输——但比"全做"省的不止 50% 工程时间，省的是"搞错方向不知止损"的机会成本。
