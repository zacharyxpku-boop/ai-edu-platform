# 5 步上线手册（moriwork 改头换面方案）

预计耗时：你 8 分钟 + 我 30 分钟。

---

## Step 1 · 清空 moriwork 旧表（你 · 2 分钟）

登 supabase.com → 找到 moriwork 项目 → 顶部改名为 `yuandian-tutor`（Settings → General）。

然后 SQL Editor → New Query → 粘贴这一行确认旧表能删：

```sql
SELECT tablename FROM pg_tables WHERE schemaname='public';
```

如果列表里**没有** `students/questions/attempts/dialogues/knowledge_points/student_states/misconceptions/textbook_sections/textbook_files/textbook_chunks` 这 10 个表名，跳到 Step 2。

如果**有**冲突，跑：

```sql
DROP TABLE IF EXISTS
    students, questions, attempts, dialogues, knowledge_points,
    student_states, misconceptions, textbook_sections,
    textbook_files, textbook_chunks
CASCADE;
```

---

## Step 2 · 启用 pgvector + 跑全部 migration（你 · 3 分钟）

Database → Extensions → 搜 `vector` → toggle on（`pgcrypto` / `pg_trgm` 通常默认开了）。

然后 SQL Editor → 打开本地文件：

```
C:\Users\86136\Desktop\claude\ai-edu-platform\scripts\migrations-all-in-one.sql
```

全选粘贴 → Run（约 5-10 秒）→ 看 "Success" 即过。

---

## Step 3 · 拿 3 件 key 给我（你 · 2 分钟）

Settings → API：
- **Project URL**（公开）
- **anon public** key
- **service_role secret** key

把这 3 个粘到对话里给我。

注意：**service_role 是机密**，仅这次给我配 Vercel 环境用。

---

## Step 4 · 同步 env 到 Vercel（你 · 1 分钟）

Vercel Dashboard → 你的 `ai-edu-platform` 项目 → Settings → Environment Variables

加 4 个（值用你刚拿到的 + 我已生成的 ADMIN_TOKEN）：

| Key | Value |
|---|---|
| SUPABASE_URL | (你给的) |
| SUPABASE_ANON_KEY | (你给的) |
| SUPABASE_SERVICE_ROLE_KEY | (你给的) |
| ADMIN_TOKEN | （已在 .env.local 自动生成，复制过去）|

`DEEPSEEK_KEY` 和 `QWEN_KEY` 之前可能 Vercel 已有 `DEEPSEEK_API_KEY`/`DASHSCOPE_API_KEY`——确认一下，没的话也加上（值同 .env.local）。

---

## Step 5 · git push 上线（你 · 30 秒）

```bash
cd C:/Users/86136/Desktop/claude/ai-edu-platform
git add -A
git status            # 看一眼新文件清单
git commit -m "feat: ai-private-tutor 全栈 ship · BKT/diagnose/retrieve/FSRS/记忆/家长端 + 6 migration + smoke-test"
git push
```

Vercel 自动检测 push → 1-2 分钟构建完成。

---

## 然后我接手（30 分钟）

你给完 key 后我立刻：

1. 跑 `seed_knowledge_points_from_ontology.py` → 71 KP 入库（5 min）
2. 跑 `seed_questions_from_json.py --source all` → 947 题入库 + KP 关联（10 min）
3. 跑 `seed_demo_students.py --seed-attempts` → 30 demo 学员 + 假数据（5 min）
4. 跑 `bash scripts/smoke-test.sh` → 17 端点 + 5 前端页全 PASS（5 min）
5. 跑 `upload_textbooks_to_storage.py` → 6 本人教初中数学传 Storage（5 min）

完成后 mastery-loop / parent-radar / admin / question-bank 全部 live。

---

## 不阻塞 PoC 但可以你顺手做的

- Fly.io 部 NCDM 服务（不部 mastery-proxy 走 mock，但雷达图就没法基于真训练数据）
- GitHub Actions secrets 配 `PROD_HOST` + `ADMIN_TOKEN`（不配 cron 不跑，但手动 POST 也能触发）

这两件 V1.5 阶段做，不影响 5.4 Demo Day。
