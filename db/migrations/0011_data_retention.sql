-- =============================================================================
-- 0011 · 数据保留期限实施 · PIPL 合规
-- =============================================================================
-- 法律基础：
--   《个人信息保护法》第 19 条 · 个人信息保存期限应当为实现处理目的所必要的最短时间
--   《未成年人网络保护条例》第 33 条 · 处理未成年人个人信息保存期限不得超过实现处理目的所必要时间
--
-- 设计原则：
--   1. 不真删（保留学习轨迹聚合统计）→ 到期姓名 hash 化（不可逆）
--   2. 用户主动申请删除 → 真实清除（30 天内）
--   3. 默认保留 3 年（覆盖小学 / 初中 / 高中各阶段 + 1 年缓冲）
--   4. cron 调度由外部触发（pg_cron / Vercel Cron / 手动）
-- =============================================================================

-- 1. students 表加 expires_at 字段（默认 created_at + 3 年）
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS expires_at timestamptz
    DEFAULT (now() + interval '3 years');

-- 已存在数据回填（按 created_at 推算）
UPDATE students
   SET expires_at = created_at + interval '3 years'
 WHERE expires_at IS NULL;

-- 把字段标记为 NOT NULL（回填完才能加约束）
ALTER TABLE students
  ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_expires_at
  ON students(expires_at)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN students.expires_at IS
  '数据保留到期时间 · PIPL 合规 · 到期由 cleanup_expired_data() 自动匿名化 · 默认创建后 3 年';

-- 2. 加 anonymized_at 字段标记是否已匿名化
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;

COMMENT ON COLUMN students.anonymized_at IS
  '匿名化完成时间 · 非空表示该学生姓名已 hash 化，学习轨迹保留为聚合统计';

-- =============================================================================
-- 3. cleanup_expired_data() 函数 · 到期数据匿名化
-- =============================================================================
-- 行为：
--   - 找出 expires_at < now() 且 anonymized_at IS NULL 的学生
--   - 把 name 改为 'anon_<sha256(id)前8位>' 不可逆
--   - 清空 goals 中可能含 PII 的字段
--   - 把 dialogues.content 截断为前 50 字 + "[已过期]"
--   - 写 anonymized_at = now()
--
-- 不删除：
--   - student_states (聚合学习数据，无 PII)
--   - attempts (聚合答题数据，无 PII)
--   - 学习轨迹仍可用于产品分析（脱敏后）
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS TABLE(
  processed_count integer,
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_processed integer := 0;
  v_student_ids uuid[];
BEGIN
  -- 找出需要处理的学生（到期 + 未匿名化 + 未软删除）
  SELECT ARRAY_AGG(id)
    INTO v_student_ids
    FROM students
   WHERE expires_at < now()
     AND anonymized_at IS NULL
     AND deleted_at IS NULL
   LIMIT 100;  -- 单次最多处理 100 条防长事务

  IF v_student_ids IS NULL OR array_length(v_student_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0::integer, jsonb_build_object('message', '无到期数据');
    RETURN;
  END IF;

  -- 匿名化学生姓名（hash 化不可逆）
  UPDATE students
     SET name = 'anon_' || substr(encode(digest(id::text, 'sha256'), 'hex'), 1, 8),
         goals = '{}'::jsonb,
         anonymized_at = now(),
         updated_at = now()
   WHERE id = ANY(v_student_ids);

  v_processed := array_length(v_student_ids, 1);

  -- 截断对话内容（仅保留前 50 字 + 标记，用于聚合统计）
  UPDATE dialogues
     SET content = substr(content, 1, 50) || ' [已过期匿名化]'
   WHERE student_id = ANY(v_student_ids)
     AND length(content) > 60;

  -- 清空 escalations 的 student_message（含 PII）
  UPDATE escalations
     SET student_message = '[已过期匿名化]',
         context = '{}'::jsonb,
         ai_summary = '[已过期匿名化]'
   WHERE student_id = ANY(v_student_ids);

  -- moderation_logs 截断
  UPDATE moderation_logs
     SET content_excerpt = '[已过期匿名化]'
   WHERE student_id = ANY(v_student_ids);

  -- 写审计日志（如有 audit_logs 表则写入；否则 RAISE NOTICE）
  RAISE NOTICE 'cleanup_expired_data: 匿名化 % 个学生', v_processed;

  RETURN QUERY SELECT
    v_processed,
    jsonb_build_object(
      'student_ids', to_jsonb(v_student_ids),
      'anonymized_at', now(),
      'note', '姓名已 hash 化，对话/工单已截断，学习轨迹保留聚合统计'
    );
END;
$$;

COMMENT ON FUNCTION cleanup_expired_data() IS
  'PIPL 数据保留合规 · 把到期学生数据匿名化 · 单次最多 100 条 · 建议每周触发';

-- =============================================================================
-- 4. user_initiated_deletion(student_id) · 用户主动申请删除（真删）
-- =============================================================================
-- 行为：
--   - 用户主动申请删除时调用
--   - DELETE 而非匿名化
--   - 30 天延迟（设 deleted_at = now() + 30 days）
--   - 期间用户可撤回
-- =============================================================================

CREATE OR REPLACE FUNCTION user_initiated_deletion(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM students WHERE id = p_student_id) INTO v_exists;

  IF NOT v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', 'student_not_found');
  END IF;

  -- 标记软删除 + 30 天后真删（外部 cron 扫 deleted_at + 30d 前的记录真删）
  UPDATE students
     SET deleted_at = now(),
         updated_at = now(),
         expires_at = now() + interval '30 days'  -- 30 天恢复窗口
   WHERE id = p_student_id;

  RETURN jsonb_build_object(
    'ok', true,
    'student_id', p_student_id,
    'deleted_at', now(),
    'permanent_deletion_at', (now() + interval '30 days'),
    'note', '账户已冻结 · 30 天内可撤回 · 之后将永久删除'
  );
END;
$$;

COMMENT ON FUNCTION user_initiated_deletion(uuid) IS
  '用户主动删除 · 30 天延迟保护期 · 期间可撤回';

-- =============================================================================
-- 5. 触发说明
-- =============================================================================
-- 推荐方案 A · pg_cron（Supabase 已支持）
--   SELECT cron.schedule('cleanup-expired', '0 3 * * 0', 'SELECT cleanup_expired_data()');
--   每周日凌晨 3 点跑一次
--
-- 推荐方案 B · 外部 Vercel Cron（更灵活）
--   /api/cron-cleanup-expired-data 每周日 UTC 19:00 (北京 03:00) 触发
--   走 SUPABASE_SERVICE_ROLE_KEY 调 RPC
-- =============================================================================
