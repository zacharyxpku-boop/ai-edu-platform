-- ========================================================================
-- Migration 0005 · knowledge_points 加字符串 code + FSRS 查询 helper
-- ========================================================================
-- knowledge_points 主键是 UUID，但 cn-k12-knowledge-ontology.json 用字符串
-- 编码（如 math.7.ch3.kp3）。前端拿到的是 code 不是 UUID，需要桥接。
-- ========================================================================

-- ----------- 1. knowledge_points 加 code -----------
ALTER TABLE knowledge_points
    ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_kp_code ON knowledge_points (code) WHERE code IS NOT NULL;

COMMENT ON COLUMN knowledge_points.code IS
    'cn-k12-knowledge-ontology.json 的 kp_id，如 math.7.ch3.kp3。前端通过 code 路由，端点内部 lookup UUID';


-- ----------- 2. helper: code → UUID 转换 -----------
CREATE OR REPLACE FUNCTION kp_uuid_from_code(p_code TEXT)
RETURNS UUID AS $$
    SELECT id FROM knowledge_points WHERE code = p_code LIMIT 1;
$$ LANGUAGE SQL STABLE;


-- ----------- 3. helper: 拉学生 fsrs due 列表（按 retrievability 排序） -----------
CREATE OR REPLACE FUNCTION fsrs_due_for_student(p_student_id UUID, p_limit INT DEFAULT 10)
RETURNS TABLE (
    knowledge_point_id UUID,
    kp_code TEXT,
    kp_name TEXT,
    mastery_score NUMERIC,
    fsrs_state JSONB,
    is_overdue BOOLEAN,
    retrievability NUMERIC,
    next_review_at TIMESTAMPTZ
) AS $$
    SELECT
        ss.knowledge_point_id,
        kp.code,
        kp.name,
        ss.mastery_score,
        ss.fsrs_state,
        (ss.next_review_at IS NULL OR ss.next_review_at <= NOW()) AS is_overdue,
        -- retrievability = 0.9^(days_since_review / stability)
        CASE
            WHEN ss.fsrs_state IS NULL OR ss.fsrs_state = '{}'::jsonb THEN 0.0
            WHEN (ss.fsrs_state->>'last_review_at') IS NULL THEN 0.0
            ELSE POWER(0.9,
                EXTRACT(EPOCH FROM (NOW() - to_timestamp((ss.fsrs_state->>'last_review_at')::bigint / 1000.0))) / 86400.0
                / GREATEST(0.1, (ss.fsrs_state->>'stability')::numeric)
            )
        END AS retrievability,
        ss.next_review_at
    FROM student_states ss
    LEFT JOIN knowledge_points kp ON kp.id = ss.knowledge_point_id
    WHERE ss.student_id = p_student_id
      AND (ss.next_review_at IS NULL OR ss.next_review_at <= NOW() + INTERVAL '12 hours')
    ORDER BY retrievability ASC, ss.next_review_at NULLS FIRST
    LIMIT p_limit;
$$ LANGUAGE SQL STABLE;


-- ----------- 4. helper: 学生总览（Khanmigo 五件家长端的数据底座） -----------
CREATE OR REPLACE FUNCTION student_overview(p_student_id UUID)
RETURNS TABLE (
    total_kps INT,
    mastered_kps INT,
    learning_kps INT,
    weak_kps INT,
    due_today_count INT,
    avg_mastery NUMERIC,
    last_active_at TIMESTAMPTZ
) AS $$
    SELECT
        COUNT(*)::INT AS total_kps,
        COUNT(*) FILTER (WHERE mastery_score >= 0.85)::INT AS mastered_kps,
        COUNT(*) FILTER (WHERE mastery_score BETWEEN 0.4 AND 0.85)::INT AS learning_kps,
        COUNT(*) FILTER (WHERE mastery_score < 0.4)::INT AS weak_kps,
        COUNT(*) FILTER (WHERE next_review_at <= NOW() + INTERVAL '12 hours')::INT AS due_today_count,
        ROUND(AVG(mastery_score)::numeric, 3) AS avg_mastery,
        MAX(last_practiced_at) AS last_active_at
    FROM student_states
    WHERE student_id = p_student_id;
$$ LANGUAGE SQL STABLE;
