# 原点智学 · 文档索引

整个 session ship 的设计 / 风险评估 / Demo 剧本一站式入口。
2026-04-27 从 `~/Desktop/ai-private-tutor/docs/` 迁过来与代码合库管理。

---

## 战略 / 顶层设计
- **AI-TUTOR-TOPDOWN-DESIGN.md** — v1.1 顶层设计（9 要素、Khanmigo 借鉴 + 反 Khanmigo 死穴、实现度评估）
- **ARCHITECTURE.md** — 技术架构总览
- **DESIGN.md** — 视觉设计系统
- **DECISIONS.md** — 关键技术决策

## 自审 / 风险评估
- **SESSION-REVIEW.md** — v1.0 自审（停手等真用户决策）
- **SESSION-REVIEW-V2.md** — v1.1 ship 后冷读自审（5 未验证假设 / 5 Demo Day 翻车风险）
- **AUDIT-LOG-V1.1.md** — 14 条潜伏 bug 时间线 + 杀伤评级 + 真实现度修正 35% → 88%

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
- `PROMPT-TUNING-DECISIONS.md` — 失败率→prompt 改写决策对照表
