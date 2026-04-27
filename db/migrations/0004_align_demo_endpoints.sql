-- ========================================================================
-- Migration 0004 · 端点字段对齐补丁
-- ========================================================================
-- Self-review 发现 0001 schema 与后续 ship 的 API 端点字段不一致。
-- 这份 migration 加最少必要字段，保持 0001 数据建模哲学不变。
-- ========================================================================

-- ---------- 1. students 加 cohort 字段 ----------
-- admin/summary 端点按 cohort=camp-2 查询五一营第二期学员
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS cohort TEXT;

CREATE INDEX IF NOT EXISTS idx_students_cohort
    ON students (cohort) WHERE deleted_at IS NULL;

COMMENT ON COLUMN students.cohort IS '批次标识，五一营第二期=camp-2，公测=public-1，等';


-- ---------- 2. dialogues 加 meta jsonb + kind ----------
-- 0001 已有 tool_calls jsonb，但语义偏 LLM tool calls
-- 我们需要更通用的 meta（装 4 字段隐性信号 / diagnose 出参 / retrieve 检索结果）
ALTER TABLE dialogues
    ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS kind TEXT;

CREATE INDEX IF NOT EXISTS idx_dialogues_kind
    ON dialogues (kind) WHERE kind IS NOT NULL;

-- 4 字段隐性信号查询用（mastery 引擎和数据分析用）
-- 全表表达式索引：partial index 的 WHERE 在 jsonb 上违反 immutability，去掉
CREATE INDEX IF NOT EXISTS idx_dialogues_signals_extracted
    ON dialogues ((meta->>'signals_extracted_at'));

COMMENT ON COLUMN dialogues.kind IS 'chat / diagnose_call / retrieve_call / hint_request / mastery_event';
COMMENT ON COLUMN dialogues.meta IS '通用 jsonb：装 signals 4 字段抽取结果 / diagnose 出参 / retrieve 命中等';


-- ---------- 3. dialogues.session_id 改可空 + 默认值 ----------
-- 0001 设的 NOT NULL，但 PoC 期前端 ad-hoc 写库时没传 session_id
-- 改为可空，默认生成新 UUID（每条独立会话）
ALTER TABLE dialogues
    ALTER COLUMN session_id DROP NOT NULL,
    ALTER COLUMN session_id SET DEFAULT gen_random_uuid();


-- ---------- 4. attempts.question_id 改可空 ----------
-- 0001 设的 NOT NULL + FK，PoC 期 mastery-loop 用硬编码题目（不在 questions 表）
-- 临时改为可空 + 弱化 FK，6.1 后真题入库后再恢复 NOT NULL
ALTER TABLE attempts
    ALTER COLUMN question_id DROP NOT NULL;


-- ---------- 5. attempts 加 question_snapshot jsonb ----------
-- 临时题（不在 questions 表）的题面快照，便于事后 review 学生答了什么
-- 真题入库后这字段 = NULL（用 question_id 指）
ALTER TABLE attempts
    ADD COLUMN IF NOT EXISTS question_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS topic_code TEXT;          -- cn-k12-knowledge-ontology 的 kp_id 字符串编码

CREATE INDEX IF NOT EXISTS idx_attempts_topic_code
    ON attempts (topic_code) WHERE topic_code IS NOT NULL;


-- ---------- 6. 给 attempts.scored_meta 加常用查询 GIN 索引 ----------
-- admin/summary 要拉 scored_meta->>'mastery_after' 做聚合
CREATE INDEX IF NOT EXISTS idx_attempts_scored_meta_gin
    ON attempts USING gin (scored_meta);


-- ---------- 7. demo 学员 seed（PoC 期间快速验证 RLS）----------
-- 在 W5 五一营结营前启用，把 30 个内测学员预先插入
-- 跑 0004 时如果还没到内测期，COMMENT 这块即可
-- INSERT INTO students (id, name, grade, stage, cohort, subjects)
-- VALUES (gen_random_uuid(), 'Demo 同学', 'middle_1', 'middle', 'camp-2', '{math}')
-- ON CONFLICT DO NOTHING;


-- ========================================================================
-- 验证：跑完后端点字段对齐正确
--   ingest-attempt:     mastery_before/after/diagnose_l3 → scored_meta jsonb
--                       临时题 → question_snapshot
--                       cn-k12 kp_id → topic_code
--   log-dialogue:       meta jsonb · kind · session_id 自动 gen
--   extract-signals:    meta->>'signals_extracted_at' IS NULL 查询能跑
--   admin/summary:      students.cohort='camp-2' · attempts.scored_meta 读 mastery_*
-- ========================================================================
