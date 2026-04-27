-- ========================================================================
-- Migration 0006 · dialogues 加 embedding（跨会话长期记忆基础）
-- ========================================================================
-- 不引 mem0 包，直接用现有 dialogues 表 + pgvector。
-- 用阿里 dashscope text-embedding-v3（1024 维），QWEN_KEY 已配。
--
-- 数据流：
--   1. mastery-loop 答题/对话 → log-dialogue 写入 dialogues
--   2. 04:00 cron 调 /api/embed-dialogue 批量给未 embedded 的对话算向量
--   3. 学生开新题时 → /api/student-memory?query=... → 拉过去最相似的 N 条对话
--   4. tutor 把这些对话拼进 system prompt，做「真私教记得你」
-- ========================================================================

-- pgvector 0002 已经 CREATE EXTENSION 过，这里直接用

ALTER TABLE dialogues
    ADD COLUMN IF NOT EXISTS embedding VECTOR(1024);   -- dashscope text-embedding-v3 = 1024

-- HNSW 索引（比 IVFFlat 稳，适合 < 100 万行）
CREATE INDEX IF NOT EXISTS idx_dialogues_embedding_hnsw
    ON dialogues USING hnsw (embedding vector_cosine_ops);

-- 部分索引：只对学生消息建（tutor / system 消息检索价值低）
CREATE INDEX IF NOT EXISTS idx_dialogues_student_role_for_memory
    ON dialogues (student_id, created_at DESC)
    WHERE role = 'student' AND embedding IS NOT NULL;


-- ----------- 检索 helper：拉某学生过去最相似的 N 条对话 -----------
-- 用法：SELECT * FROM student_memory_search('uuid-of-student', '<vec>', 5);
CREATE OR REPLACE FUNCTION student_memory_search(
    p_student_id UUID,
    p_query_embedding VECTOR(1024),
    p_top_k INT DEFAULT 5,
    p_min_age_seconds INT DEFAULT 1800     -- 30 分钟内的对话不召回（避免拉刚说的话当回忆）
) RETURNS TABLE (
    dialogue_id UUID,
    role TEXT,
    content TEXT,
    kind TEXT,
    similarity FLOAT,
    created_at TIMESTAMPTZ,
    signals JSONB
) AS $$
    SELECT
        d.id,
        d.role::text,
        d.content,
        d.kind,
        1 - (d.embedding <=> p_query_embedding) AS similarity,
        d.created_at,
        d.meta->'signals' AS signals
    FROM dialogues d
    WHERE d.student_id = p_student_id
      AND d.embedding IS NOT NULL
      AND d.created_at < NOW() - (p_min_age_seconds || ' seconds')::INTERVAL
    ORDER BY d.embedding <=> p_query_embedding
    LIMIT p_top_k;
$$ LANGUAGE SQL STABLE;


-- ----------- 学生「记忆指纹」（用于摘要展示给 tutor）-----------
-- 把该学生最近 30 天 dialogues.meta.signals 聚合，统计高频卡点 / 主导情绪等
CREATE OR REPLACE FUNCTION student_signal_profile(p_student_id UUID)
RETURNS TABLE (
    top_stuck_points TEXT[],
    top_misconceptions TEXT[],
    dominant_emotion TEXT,
    analogy_success_rate NUMERIC,
    total_dialogues INT,
    total_with_signals INT
) AS $$
    WITH recent AS (
        SELECT meta->'signals' AS s, meta->>'signals_extracted_at' AS ext_at
        FROM dialogues
        WHERE student_id = p_student_id
          AND created_at > NOW() - INTERVAL '30 days'
          AND meta ? 'signals'
    ),
    stuck AS (
        SELECT s->>'stuck_point' AS sp, COUNT(*) AS c
        FROM recent
        WHERE s->>'stuck_point' IS NOT NULL AND s->>'stuck_point' != 'null'
        GROUP BY 1 ORDER BY c DESC LIMIT 5
    ),
    misc AS (
        SELECT s->>'misconception_l3' AS m, COUNT(*) AS c
        FROM recent
        WHERE s->>'misconception_l3' IS NOT NULL AND s->>'misconception_l3' != 'null'
        GROUP BY 1 ORDER BY c DESC LIMIT 5
    ),
    emo AS (
        SELECT s->>'emotion_state' AS e, COUNT(*) AS c
        FROM recent
        WHERE s->>'emotion_state' IS NOT NULL
        GROUP BY 1 ORDER BY c DESC LIMIT 1
    ),
    analogy AS (
        SELECT
            COUNT(*) FILTER (WHERE (s->>'analogy_effective')::boolean = true) AS hits,
            COUNT(*) FILTER (WHERE (s->>'analogy_effective')::boolean IS NOT NULL) AS total
        FROM recent
    )
    SELECT
        ARRAY(SELECT sp FROM stuck),
        ARRAY(SELECT m FROM misc),
        (SELECT e FROM emo),
        CASE WHEN (SELECT total FROM analogy) > 0
             THEN ROUND((SELECT hits FROM analogy)::numeric / (SELECT total FROM analogy)::numeric, 3)
             ELSE NULL END,
        (SELECT COUNT(*)::INT FROM dialogues WHERE student_id = p_student_id AND created_at > NOW() - INTERVAL '30 days'),
        (SELECT COUNT(*)::INT FROM recent);
$$ LANGUAGE SQL STABLE;
