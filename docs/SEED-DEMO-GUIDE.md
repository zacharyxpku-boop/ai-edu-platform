# Demo 账号种子运行手册

让 5.4 demo / 真孩子录屏现场不显「数据积累中…」「读取记忆中…」这类空架子。

照下面 4 步走，全部完成 ≈ 8 分钟。

---

## 前置确认（30 秒）

打开 Vercel Dashboard → 项目 yuandian-ai-tutor → Environment Variables，确认以下 4 个变量都设了 Production 值：

| 变量 | 用途 | 没有就 |
|---|---|---|
| `SUPABASE_URL` | 库地址 | 端点全 500 |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端写 RLS bypass | 写不进 dialogues |
| `QWEN_KEY`（或 `DASHSCOPE_API_KEY`）| 调阿里 embedding | 第 3 步 502 |
| `ADMIN_TOKEN` | 保护 embed 端点 | 第 3 步 401 |

任一项缺失先在 Vercel 补好再继续，不要跳。

---

## 第 1 步 · 跑对话种子（2 分钟）

打开 Supabase Dashboard → 你的项目 → 左侧菜单 SQL Editor → New query。

把 `scripts/seed-demo-dialogues.sql` 整个文件内容粘贴进去 → Run。

**期望输出**：
```
NOTICE: Demo seed inserted: 16 dialogues for demo-student-001 (12 student + 4 tutor)

total | visual_count | anxious_count | analogy_true | analogy_false
   16 |            5 |             6 |            4 |             2
```

数字对得上就过。对不上检查：
- 报 `relation "dialogues" does not exist` → 0001_init.sql 没跑过，先跑 db/migrations 全部
- 报 `grade_enum does not exist` → 同上
- 报 `duplicate key on knowledge_points.code` → 之前跑过本份 SQL，安全（ON CONFLICT DO NOTHING 兜底）

---

## 第 1.5 步 · 灌初一数学全册 KP 树（1 分钟，新增于 P0-C）

5.4 demo 现场家长会问「除了一元一次方程还有啥」——左栏需要看到第 1 章有理数 / 第 4 章几何 / 第 8 章二元一次方程组 等都在。这一步就是把这些 KP 落库（前端 hardcode 已经有名字，但 BKT/状态查询要库里真有这些行）。

回到 SQL Editor → New query → 粘贴 `scripts/seed-kp-grade7-math.sql` → Run。

**期望输出**：
```
INSERT 0 36   (前置 ch3 七条 + ch2 两条已 demo seed 过 → ON CONFLICT 跳过；新增 36 条)

chapter      | kp_count
-------------+----------
math.7.ch1   | 5
math.7.ch2   | 4
math.7.ch3   | 7
math.7.ch4   | 5
math.7.ch5   | 5
math.7.ch6   | 3
math.7.ch7   | 3
math.7.ch8   | 4
math.7.ch9   | 4
math.7.ch10  | 3
                合计 43
```

跳过 ON CONFLICT 是预期行为，不是 bug——重跑这份 SQL 永远安全。

## 第 2 步 · 跑 BKT 状态种子（1 分钟）

回到 SQL Editor → New query → 粘贴 `scripts/seed-demo-states.sql` → Run。

**期望输出**：
```
NOTICE: student_states seeded for demo-001: 4 KPs (done=2, active=1, due=1)

code            | name              | mastery_score | att_correct | last_practiced | next_review | stage
math.7.ch3.kp1  | 一元一次方程概念   |         0.92  |      12/11  | 04-23 ...      | 05-04 ...   | 已掌握 ✓
math.7.ch3.kp2  | 等式性质          |         0.85  |      10/9   | 04-24 ...      | 05-03 ...   | 已掌握 ✓
math.7.ch3.kp3  | 解方程·移项       |         0.62  |       8/5   | 04-28 ...      | 04-29 ...   | 攻克中 ●
math.7.ch3.kp4  | 解方程·去分母     |         0.18  |       3/1   | 04-26 ...      | 04-28 ...   | 待补 ○
```

报 `前置 KP 缺失` → 第 1 步没跑或被回滚，回去重跑。

---

## 第 3 步 · 给 16 条对话补 1024 维向量（4 分钟）

dialogues 入库时 embedding 列是 NULL，需要调端点批量算 + 写回。不做这步跨会话语义搜索（"上次类比那个"）回不来。

终端跑：

```bash
curl -X POST "https://yuandianzhixue.com/api/embed-dialogue?limit=200" \
  -H "X-Admin-Token: <你的 ADMIN_TOKEN 值>"
```

`<你的 ADMIN_TOKEN 值>` 替换成 Vercel env 里那串。

**期望响应**（约 30-60 秒后返回）：
```json
{
  "ok": true,
  "fetched": 12,
  "embedded": 12,
  "elapsed_ms": 4820
}
```

`embedded` 应等于 `fetched`，且 ≥ 12（演示账号 12 条 student 对话；tutor 角色不 embed）。

**常见失败**：
- 401 → ADMIN_TOKEN 没对上，去 Vercel 复制完整值
- 502 + `dashscope ...` → QWEN_KEY 失效或欠费，登 dashscope.console.aliyun.com 充值
- 200 但 `embedded: 0` → 已经全部 embed 过（重跑安全），用下方验证查询确认

---

## 第 4 步 · 验证 demo 真活了（1 分钟）

回 Supabase SQL Editor 跑：

```sql
-- 验证 1：embedding 都补上了
SELECT count(*) AS total,
       count(embedding) AS embedded,
       count(*) - count(embedding) AS still_null
FROM dialogues
WHERE student_id = '00000000-0000-0000-0000-000000000001'
  AND role = 'student';
-- 期望：total=12, embedded=12, still_null=0
```

```sql
-- 验证 2：信号聚合能跑（tutor 启动 prompt 拉这个）
SELECT
    mode() WITHIN GROUP (ORDER BY meta->'signals'->>'cognitive_style') AS dominant_style,
    mode() WITHIN GROUP (ORDER BY meta->'signals'->>'emotion_state') AS dominant_emotion
FROM dialogues
WHERE student_id = '00000000-0000-0000-0000-000000000001'
  AND meta->'signals'->>'cognitive_style' != 'unknown';
-- 期望：visual / 焦虑
```

最后打开 https://yuandianzhixue.com/tutor.html?student_id=00000000-0000-0000-0000-000000000001&name=小米

顶部副标题应显示「记得 N 条 · 最弱 X 处」（不是「读取记忆中…」）。
右栏「现在练 解方程·移项 掌握度 0.62」（不是 hardcode 0.62 — 是真从 student_states 读）。

任何一处仍显占位 → 说明前端还没接 RPC，是后续工作（HONEST-GAP-AUDIT 第 3 件 ROI），SQL 这边没问题。

---

## 撤销（如果种子跑坏了）

```sql
DELETE FROM dialogues
WHERE student_id = '00000000-0000-0000-0000-000000000001'
  AND meta->>'seed_source' = 'demo-day-2026-05-04';

DELETE FROM student_states
WHERE student_id = '00000000-0000-0000-0000-000000000001';

-- knowledge_points 一般不删（其他模块依赖），需要时只清 grade7 ontology seed：
-- DELETE FROM knowledge_points WHERE source = 'ontology-grade7-v1';
-- 警告：跑这条会让前端左栏切到非第 3 章 KP 时 BKT 查询拿空，仅在 KP 表彻底重灌时用
```

撤销后从第 1 步重来即可。

---

## 一键全跑（可选，给运维）

如果你信任自己一次跑全部不出问题：

```sql
-- 把这 3 份合并粘贴到一个 SQL Editor query 跑
-- 顺序固定：先 KP 树 → 再 dialogues → 再 states
-- (因为 dialogues seed 内部也 INSERT 了 ch3 KPs，states seed 依赖 KP)

\i scripts/seed-kp-grade7-math.sql
\i scripts/seed-demo-dialogues.sql
\i scripts/seed-demo-states.sql
```

Supabase Web SQL Editor 不支持 `\i`，需要把 3 个 .sql 内容拼起来 paste。本地 psql 才能用 `\i`。

---

**版本**：v1.0 · 2026-04-28
**配套文件**：scripts/seed-demo-dialogues.sql · scripts/seed-kp-grade7-math.sql · scripts/seed-demo-states.sql · api/embed-dialogue.js · api/student-kp-states.js · api/student-recent-dialogues.js
**下一步配套**：把 tutor.html 右栏 hardcode 改成调 student_signal_profile RPC 读真数据（HONEST-GAP-AUDIT 第 3 件，2h 工作量，下个 commit）
