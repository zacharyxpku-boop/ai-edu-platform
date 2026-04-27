# ai-edu-platform · 全栈索引

第一次打开本 repo 看这一份。

---

## 一句话

原点 AI 私教 PoC：中国 K12 应试提分的「自研壁垒型」 AI 私教，目标 4 周让单知识点掌握度提升 ≥ 0.5 SD（Khanmigo 公开数据 0.23 SD 一倍）。

---

## 用户视角的 5 条路径

### 学生
1. 扫码 → `/start` → mastery-loop 25 分钟闭环 → 化神 → 朋友圈分享卡
2. 浏览真题：`/question-bank` 947 道真题（高考 + 中考）筛选

### 家长
3. `/parent` → parent-radar 雷达 + 三档大字 + FSRS 今日复习
4. 6.1 收 PDF：`/parent-report?period=4w` 4 周提分对比报告

### 运营
5. `/admin` → 5 KPI + 14 天活跃曲线 + 错题归因 Top 5 + 学员风险表

---

## API 端点目录（17 个）

| 路径 | 用途 | runtime | 依赖 env |
|---|---|---|---|
| POST `/api/bkt` | BKT 算法（5 行 + difficulty bonus） | edge | — |
| POST `/api/diagnose` | 64 类错题归因（has_error 门控） | edge | DEEPSEEK_KEY/QWEN_KEY |
| POST `/api/retrieve` | 苏格拉底 prompt 拼装（feynman 4 步法 + 20 seeds） | edge | — |
| POST `/api/llm-route` | 统一模型路由（5 类任务，自动 fallback） | edge | DEEPSEEK_KEY/QWEN_KEY |
| POST `/api/ingest-attempt` | attempts 写库 | edge | SUPABASE_* |
| POST `/api/log-dialogue` | dialogues 写库 | edge | SUPABASE_* |
| GET  `/api/standard-info` | 课标对齐查询 | edge | — |
| GET  `/api/knowledge-tree` | 知识点 71 KP 树 + 先修链 | edge | — |
| GET  `/api/fsrs-due` | 今日复习队列（带 RPC 加速选项） | edge | SUPABASE_* |
| POST `/api/fsrs-update` | FSRS state UPSERT + code/UUID 桥接 | edge | SUPABASE_SERVICE_ROLE_KEY |
| POST `/api/extract-dialogue-signals` | 4 字段抽取（cron 用） | edge | + ADMIN_TOKEN |
| POST `/api/embed-dialogue` | dashscope embedding（cron 用） | edge | + ADMIN_TOKEN |
| POST `/api/student-memory` | 跨会话记忆检索 | edge | + QWEN_KEY |
| GET  `/api/admin/summary` | 看板数据聚合 | edge | + ADMIN_TOKEN |
| ANY  `/api/mastery-proxy/*` | NCDM Fly.io 服务代理 | edge | NCDM_HOST |
| 已有 `/api/ai-proxy` `/api/lead` `/api/track` `/api/chapter-match` `/api/chapter-ensemble` |  |  |  |

---

## 数据底座

```
Supabase Postgres (Singapore Free → Pro)
├─ 12 表（0001-0006 migration）
│   knowledge_points · students · student_states · questions · attempts
│   misconceptions · dialogues · textbook_sections · textbook_files
│   textbook_chunks · ...
├─ 7 enum
├─ pgvector 双维度（1024 dialogues / 1536 textbook_chunks）
├─ 5 PG function（kp_uuid_from_code · fsrs_due_for_student · student_overview
│   · student_memory_search · student_signal_profile · search_textbook_chunks · takedown_textbooks）
└─ Storage: textbooks bucket (private, methodA+, 用 takedown 函数熔断)
```

---

## 关键文件路径

```
ai-edu-platform/
├─ src/curriculum/
│   ├─ cn-k12-knowledge-ontology.json     71 KP / 12 章 / math 7-9
│   ├─ course-standard-alignment.json     12 topic 对齐 2022 课标
│   ├─ questions-from-eeval.json          236 中考评测题
│   ├─ questions-from-gaokao.json         850+ 高考真题
│   ├─ mistake-taxonomy.json              64 类错题（既有）
│   └─ feynman-prompts.json               20 苏格拉底种子（既有）
├─ src/lib/fsrs.js                        FSRS-4.5 简化 9 参数版
├─ scripts/
│   ├─ build-question-bank-from-eeval.py
│   ├─ build-question-bank-from-gaokao.py
│   └─ smoke-test.sh                      端到端 15 端点验证
├─ services/ncdm/                         Fly.io 香港机房 NCDM 服务
└─ DEPLOY.md / PRODUCT-INDEX.md（本档）

ai-private-tutor/
├─ packages/db/migrations/0001-0006.sql
├─ scripts/data-pipeline/
│   ├─ seed_knowledge_points_from_ontology.py
│   ├─ seed_questions_from_json.py        947 题入库 + 关联 KP UUID
│   ├─ upload_textbooks_to_storage.py
│   └─ fetch_chinatextbook.py
└─ docs/
    ├─ BATTLEPLAN.md / CAMP_DEMO_DAY_SCRIPT.md
    ├─ INTERNAL_TEST_ONBOARDING.md / PHASE_1_LOOP_DESIGN.md
    ├─ VISUAL_TEXTBOOK_DESIGN.md
    └─ PRODUCT-TECH-STATUS.md / SESSION-SHIP-LOG.md
```

---

## 上线 7 步

1. supabase.com 新建 `yuandian-tutor`（Singapore Free）→ 拿 3 件 key
2. Vercel 配 4 env：`SUPABASE_URL` `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `ADMIN_TOKEN`
3. SQL Editor 启用 pgvector → 顺跑 0001 → 0002 → 0003 → 0004 → 0005 → 0006
4. Storage 建 `textbooks` private bucket（限 PDF / 50MB）
5. `python seed_knowledge_points_from_ontology.py` → 71 KP 入库
6. `python seed_questions_from_json.py --source all` → 947 题入库 + 关联 KP UUID
7. `git push` → Vercel auto deploy → `bash scripts/smoke-test.sh` 全 PASS

---

## 顶层规划完成度

详见 `ai-private-tutor/docs/PRODUCT-TECH-STATUS.md`：
- 战略层 100% / W1-W4 PoC 100% / 真壁垒 90% / P1 武器 67%
- 总体 92% · 剩 8% = Supabase 接入 + 真数据上线

---

## 你不该自己改的（GSD 工作流）

`ai-private-tutor` 是 GSD 项目，按 CLAUDE.md「Edit / Write / 其他文件操作前必须走 GSD 命令」。
入口：`/gsd:quick`（小修补）/ `/gsd:debug`（bug）/ `/gsd:execute-phase`（计划工作）。

`ai-edu-platform` 不在 GSD 项目下，可自由 Edit。

---

**文档版本**：v1.0 · 2026-04-26
