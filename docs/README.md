# 原点学伴 · 文档索引

当前对外叙事以“小程序优先的家庭晚间学习效率工具”为准：作业/测评录入 -> 弱点雷达 -> 作业三分类 -> 原小点思路引导 -> 复习卡 -> 家长周报。

## 当前优先阅读

- **ARCHITECTURE.md** — 产品技术路线与系统架构。
- **MINIAPP-OPEN-ME-FIRST.md** — 小程序上架入口。
- **MINIAPP-LOW-COST-LAUNCH-WARROOM.md** — 最低成本上线作战室。
- **MINIAPP-REVIEW-COPY-PASTE.md** — 微信审核材料。
- **PRODUCT-TECH-STATUS.md** — 当前产品与技术状态。

## 历史索引使用规则

以下早期 AI tutor、课程、竞品拆解和实验文档保留为历史探索材料，不代表当前首版定位，不能直接作为官网、小程序审核或投资人材料使用。当前版本不主张“保证提分”，不主张替代老师，不把产品包装成 AI 私教。

---

整个 session ship 的设计 / 风险评估 / Demo 剧本一站式入口。
2026-04-27 从 `~/Desktop/ai-private-tutor/docs/` 迁过来与代码合库管理。

末次大刷新 2026-04-28：v1.1 实验赌桌阶段 + observability 工程化新增 8 文档 + 1 sunset 目录。

---

## v1.1 实验赌桌阶段（2026-04-28 新增）

> 推荐入口：先读 [`SESSION-WIND-DOWN-2026-04-28.md`](./SESSION-WIND-DOWN-2026-04-28.md) 5 分钟看全程

- **V1.0-TO-V1.1-DIFF.md** — 阶段对照表 + 5/4 demo checklist 9 项
- **EXPERIMENT-WEEK-v1.1.md** — 6 候选 EXP 假设/止损/排期
- **OBSERVABILITY-MINIMAL.md** — 6 段 console snippet + npm test 工作流
- **KA-LOCALIZE-MILESTONE-v1.md** — v1.0 交付清单 7 模块映射 KA 原型
- **KHANMIGO-GAP-ANALYSIS-2026-04-28.md** — Khanmigo 14 维差距分析(parallel session)
- **HONEST-GAP-AUDIT.md** — 诚实差距审计 v1（96% -> 68%）
- **SESSION-LOG-2026-04-28-pm.md** — 中场 standup（11 commit + 3 判断）
- **SESSION-LOG-2026-04-28-night.md** — 深夜场 standup（observability 主线）
- **SESSION-WIND-DOWN-2026-04-28.md** — 全程 wind-down 总览
- **sunset/** — 失败实验审计目录（含 EXP-1 英语 OCR blocker）

## 战略 / 顶层设计

- **AI-TUTOR-TOPDOWN-DESIGN.md** — v1.1 顶层设计（9 要素、Khanmigo 借鉴 + 反 Khanmigo 死穴、实现度评估）
- **KHANMIGO-LEARNINGS.md** — 团队营销 / 公众号 / UI 文案弹药库（7 节 · 5 句家长金句 + 6 场景口袋词 + 反向差异化清单）
- **ARCHITECTURE.md** — 技术架构总览
- **DESIGN.md** — 视觉设计系统
- **DECISIONS.md** — 关键技术决策

## 自审 / 风险评估

- **SESSION-REVIEW.md** — v1.0 自审（停手等真用户决策）
- **SESSION-REVIEW-V2.md** — v1.1 ship 后冷读自审（5 未验证假设 / 5 Demo Day 翻车风险）
- **AUDIT-LOG-V1.1.md** — 14 条潜伏 bug 时间线 + 杀伤评级 + 真实现度修正 35% -> 88%

## Demo 剧本 / 试用 SOP

- **DEMO-DAY-5.4-PLAYBOOK.md** — 5.4 现场 4 页脚本（30 秒 pitch / 演示动作 / Q&A / 翻车应急）
- **REAL-KID-TEST-SCRIPT.md** — 录屏试用 SOP（前置铁律 + 阶段 ABC + 最低成功线）
- **CAMP_DEMO_DAY_SCRIPT.md** — 营地 Demo Day 早期剧本

## 落地实施

- **BATTLEPLAN.md** — 整体作战计划
- **INTERNAL_TEST_ONBOARDING.md** — 内测 onboarding
- **PHASE_1_LOOP_DESIGN.md** — Phase 1 闭环设计
- **PRODUCT-TECH-STATUS.md** — 产品技术状态快照
- **SESSION-SHIP-LOG.md** — ship 日志
- **VISUAL_TEXTBOOK_DESIGN.md** — 视觉化教科书引擎设计

## 数据库 migrations

所有 SQL 在 `db/migrations/` 0001-0006，按编号顺序在 Supabase SQL Editor 跑。

- 0001 初始 schema（12 表 + 7 enum）
- 0002 textbook_files + Storage + pgvector(1536) + 一键熔断函数
- 0003 RLS 策略
- 0004 字段对齐补丁
- 0005 kp.code 字段 + 3 个 PG 函数
- 0006 dialogues vector(1024) + 2 个记忆 RPC

## 评测套件文档

位于 `scripts/`：

- `EVAL-README.md` — A/B/C/D 四件评测套件操作手册
- `PROMPT-TUNING-DECISIONS.md` — 失败率 -> prompt 改写决策对照表

## 自动化测试 (2026-04-28 新)

仓根 `npm test` 串行跑两段：

- `scripts/observability-dry-run.cjs` — 8 case 验 streak / event ring buffer / funnel 计算
- `scripts/check-static-links.cjs` — 扫 34 HTML 文件 499 内部链接 404 lint
- `.github/workflows/test.yml` — push/PR 自动触发, 详 OBSERVABILITY-MINIMAL.md

## V2 prompt 实验线

- **PROMPT-V2-DRAFT.md / PROMPT-AUDIT-V1.2.md / V2-PREDICTED-LIFT.md** — V2 prompt 4 决议+预期效果
- **SEED-DEMO-GUIDE.md** — demo 账号种子 4 步指南
- **P0-DEPLOY-MISMATCH-2026-04-28.md** — Vercel 部署漂移 P0 排查

## 标签 (git tag)

- `v1.0-ka-wave` — 8 学科枢纽 + 错题冲关 + 战利品墙等基础铺设
- `v1.1-experiment-wave` — 4 EXP 落地 + 实验赌桌文档
- `v1.1.1-observability-hardened` — 5/4 demo deploy candidate（npm test + CI）
# 当前推荐入口：v0.9 上架与内测收尾

请优先阅读：

- [V0.9-SHIP-INDEX.md](./V0.9-SHIP-INDEX.md)
- [MINIAPP-V0.9-LAUNCH-RUNBOOK.md](./MINIAPP-V0.9-LAUNCH-RUNBOOK.md)
- [10-FAMILY-PILOT-RUNBOOK.md](./10-FAMILY-PILOT-RUNBOOK.md)
- [INVESTOR-DEMO-SCRIPT-V0.9.md](./INVESTOR-DEMO-SCRIPT-V0.9.md)

旧文档保留为历史材料；对外审核、内测、融资演示以 v0.9 收尾文档为准。
