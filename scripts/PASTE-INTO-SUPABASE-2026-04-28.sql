-- 🎯 30 秒粘贴进 Supabase 一次就完事（v2 · 修 escalation_kind_enum does not exist）
-- 操作：
--   1. 打开 https://supabase.com/dashboard
--   2. 你的 ai-edu-platform project → 左侧菜单 SQL Editor → New query
--   3. 全选本文件内容粘贴 → Run
--   4. 看到下面 NOTICE 就成功了
--
-- 这份是 0007 (escalations base) + 0008 (T1-T7) + 0009 (parent-push) + 0010 (moderation) + 0011 (PIPL retention)
-- 全部幂等，已经跑过的部分会 skip，没跑过的补上。
-- 如果你之前跑过旧版 paste 报错半截，直接重跑这份就行。

-- ════════════════════════════════════════════════════════════════════
-- 0007 · escalations 表 + enum 基础（如果之前没跑过）
-- ════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE escalation_kind_enum AS ENUM (
    'concept', 'emotion', 'streak_3_wrong', 'planning', 'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE escalation_status_enum AS ENUM (
    'pending', 'claimed', 'resolved', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS escalations (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  dialogue_id                 uuid REFERENCES dialogues(id) ON DELETE SET NULL,
  topic_code                  text,
  kind                        escalation_kind_enum NOT NULL,
  status                      escalation_status_enum NOT NULL DEFAULT 'pending',
  student_message             text NOT NULL,
  context                     jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_summary                  text,
  priority                    smallint NOT NULL DEFAULT 3,
  assigned_mentor_id          uuid,
  expected_response_minutes   int NOT NULL DEFAULT 30,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  claimed_at                  timestamptz,
  resolved_at                 timestamptz,
  resolution_kind             text,
  resolution_content          text,
  resolution_minutes          int,
  student_rating              smallint,
  meta                        jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_escalations_student   ON escalations(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalations_pending   ON escalations(status, priority, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_escalations_mentor    ON escalations(assigned_mentor_id, status) WHERE assigned_mentor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_escalations_kind_time ON escalations(kind, created_at DESC);

ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_full" ON escalations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "student_own_read" ON escalations
    FOR SELECT TO authenticated
    USING (student_id IN (SELECT id FROM students WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION fn_escalation_calc_minutes() RETURNS trigger AS $$
BEGIN
  IF NEW.resolved_at IS NOT NULL AND OLD.resolved_at IS NULL THEN
    NEW.resolution_minutes := EXTRACT(EPOCH FROM (NEW.resolved_at - NEW.created_at)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_escalation_calc_minutes ON escalations;
CREATE TRIGGER trg_escalation_calc_minutes
  BEFORE UPDATE ON escalations
  FOR EACH ROW EXECUTE FUNCTION fn_escalation_calc_minutes();

DO $$ BEGIN RAISE NOTICE '[1/5] 0007 escalations 基础完成 ✓'; END $$;

-- ════════════════════════════════════════════════════════════════════
-- 0008 · T1-T7 escalation 扩 enum + crisis 触发器更新
-- ════════════════════════════════════════════════════════════════════

ALTER TYPE escalation_kind_enum ADD VALUE IF NOT EXISTS 'cross_chapter';
ALTER TYPE escalation_kind_enum ADD VALUE IF NOT EXISTS 'crisis';
ALTER TYPE escalation_kind_enum ADD VALUE IF NOT EXISTS 'out_of_scope';

-- 重写 priority 触发器函数：crisis 强制 1 / emotion 1 / concept 等 2
CREATE OR REPLACE FUNCTION fn_escalation_set_priority() RETURNS trigger AS $$
BEGIN
  IF NEW.priority IS NULL OR NEW.priority = 3 THEN
    NEW.priority := CASE NEW.kind
      WHEN 'crisis' THEN 1
      WHEN 'emotion' THEN 1
      WHEN 'concept' THEN 2
      WHEN 'streak_3_wrong' THEN 2
      WHEN 'cross_chapter' THEN 2
      WHEN 'manual' THEN 2
      WHEN 'planning' THEN 3
      WHEN 'out_of_scope' THEN 3
      ELSE 3
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_escalation_set_priority ON escalations;
CREATE TRIGGER trg_escalation_set_priority
  BEFORE INSERT ON escalations
  FOR EACH ROW EXECUTE FUNCTION fn_escalation_set_priority();

-- 注意 1：partial WHERE 直接 kind = 'crisis' → 55P04（同 TX 新 enum 字面量）
-- 注意 2：partial WHERE kind::text = 'crisis' → 42P17（cast 是 STABLE 不是 IMMUTABLE）
-- 解：放弃 partial，做成普通复合索引，按 kind+status 一起索引
CREATE INDEX IF NOT EXISTS idx_escalations_kind_status_time
  ON escalations(kind, status, created_at DESC);

DO $$ BEGIN RAISE NOTICE '[2/5] T1-T7 enum 扩 3 类 + crisis 索引 ✓'; END $$;

-- ════════════════════════════════════════════════════════════════════
-- 0009 · 家长 push 通知队列
-- ════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE push_trigger_kind_enum AS ENUM (
    'emotion_signals', 'escalation_overdue', 'weekly_brief',
    'monthly_summary', 'crisis'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE push_status_enum AS ENUM (
    'pending', 'sent', 'read', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS parent_pushes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  trigger_kind    push_trigger_kind_enum NOT NULL,
  title           text NOT NULL,
  body            text NOT NULL,
  deeplink        text,
  priority        smallint NOT NULL DEFAULT 3,
  status          push_status_enum NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  read_at         timestamptz,
  meta            jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_pushes_student_unread
  ON parent_pushes(student_id, created_at DESC)
  WHERE status IN ('pending', 'sent');

-- timestamptz->date 转换是 STABLE，进 index 表达式被拒（42P17）
-- 用 epoch 算「北京日序号」当 IMMUTABLE wrapper · 同 student+kind 一天一条的 dedup 语义不变
CREATE OR REPLACE FUNCTION immutable_day_beijing(ts timestamptz)
RETURNS integer LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $body$
  SELECT ((extract(epoch from ts)::bigint + 8*3600) / 86400)::int
$body$;

CREATE INDEX IF NOT EXISTS idx_pushes_kind_day
  ON parent_pushes(student_id, trigger_kind, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pushes_dedup
  ON parent_pushes(student_id, trigger_kind, immutable_day_beijing(created_at));

ALTER TABLE parent_pushes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_full" ON parent_pushes
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN RAISE NOTICE '[3/5] parent_pushes 表 + 去重索引 ✓'; END $$;

-- ════════════════════════════════════════════════════════════════════
-- 0010 · Moderation 审核日志（Khanmigo 5.5 安全机制）
-- ════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE moderation_verdict_enum AS ENUM ('clean', 'flag', 'block', 'escalate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS moderation_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid REFERENCES students(id) ON DELETE CASCADE,
  dialogue_id     uuid REFERENCES dialogues(id) ON DELETE SET NULL,
  role            text NOT NULL,
  content_excerpt text NOT NULL,
  verdict         moderation_verdict_enum NOT NULL,
  flags           jsonb DEFAULT '[]'::jsonb,
  actions_taken   text[] DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mod_student_recent ON moderation_logs(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_severity ON moderation_logs(verdict, created_at DESC)
  WHERE verdict IN ('flag', 'block', 'escalate');

ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_full" ON moderation_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN RAISE NOTICE '[4/5] moderation_logs 审核表 ✓'; END $$;

-- ════════════════════════════════════════════════════════════════════
-- 0011 · PIPL 数据保留期限实施（合规必要 · Agent C ship）
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS expires_at   timestamptz DEFAULT (now() + interval '3 years');
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;

UPDATE students SET expires_at = created_at + interval '3 years' WHERE expires_at IS NULL;

DO $$ BEGIN
  ALTER TABLE students ALTER COLUMN expires_at SET NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_students_expires_at
  ON students(expires_at) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS TABLE(processed_count integer, details jsonb)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_processed integer := 0;
  v_student_ids uuid[];
BEGIN
  SELECT ARRAY_AGG(id) INTO v_student_ids
    FROM students
   WHERE expires_at < now() AND anonymized_at IS NULL AND deleted_at IS NULL
   LIMIT 100;

  IF v_student_ids IS NULL OR array_length(v_student_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0::integer, jsonb_build_object('message', '无到期数据');
    RETURN;
  END IF;

  UPDATE students
     SET name = 'anon_' || substr(encode(digest(id::text, 'sha256'), 'hex'), 1, 8),
         goals = '{}'::jsonb,
         anonymized_at = now(),
         updated_at = now()
   WHERE id = ANY(v_student_ids);

  v_processed := array_length(v_student_ids, 1);

  UPDATE dialogues SET content = substr(content, 1, 50) || ' [已过期匿名化]'
   WHERE student_id = ANY(v_student_ids) AND length(content) > 60;

  UPDATE escalations
     SET student_message = '[已过期匿名化]', context = '{}'::jsonb, ai_summary = '[已过期匿名化]'
   WHERE student_id = ANY(v_student_ids);

  UPDATE moderation_logs SET content_excerpt = '[已过期匿名化]'
   WHERE student_id = ANY(v_student_ids);

  RAISE NOTICE 'cleanup_expired_data: 匿名化 % 个学生', v_processed;

  RETURN QUERY SELECT v_processed,
    jsonb_build_object(
      'student_ids', to_jsonb(v_student_ids),
      'anonymized_at', now(),
      'note', '姓名 hash 化，对话/工单截断，学习轨迹保留聚合统计'
    );
END;
$$;

CREATE OR REPLACE FUNCTION user_initiated_deletion(p_student_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM students WHERE id = p_student_id) INTO v_exists;
  IF NOT v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', 'student_not_found');
  END IF;

  UPDATE students
     SET deleted_at = now(), updated_at = now(),
         expires_at = now() + interval '30 days'
   WHERE id = p_student_id;

  RETURN jsonb_build_object(
    'ok', true, 'student_id', p_student_id,
    'deleted_at', now(),
    'permanent_deletion_at', (now() + interval '30 days'),
    'note', '账户冻结 · 30 天可撤回 · 之后永久删除'
  );
END;
$$;

DO $$ BEGIN RAISE NOTICE '[5/5] PIPL 保留期限 + cleanup/user_delete 函数 ✓'; END $$;

-- ════════════════════════════════════════════════════════════════════
-- 验证查询（跑完看一眼数字对得上就行）
-- ════════════════════════════════════════════════════════════════════
SELECT '✅ escalation_kind_enum 总值数（应 = 8）' AS check_name,
       count(*) AS value_count
  FROM pg_enum WHERE enumtypid = 'escalation_kind_enum'::regtype
UNION ALL
SELECT '✅ escalations 表存在（应 = 1）',          count(*)::int FROM information_schema.tables WHERE table_name = 'escalations'
UNION ALL
SELECT '✅ parent_pushes 表存在（应 = 1）',        count(*)::int FROM information_schema.tables WHERE table_name = 'parent_pushes'
UNION ALL
SELECT '✅ push_trigger_kind_enum 总值数（应 = 5）', count(*)::int FROM pg_enum WHERE enumtypid = 'push_trigger_kind_enum'::regtype
UNION ALL
SELECT '✅ moderation_logs 表存在（应 = 1）',      count(*)::int FROM information_schema.tables WHERE table_name = 'moderation_logs'
UNION ALL
SELECT '✅ students.expires_at 字段存在（应 = 1）', count(*)::int FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'expires_at'
UNION ALL
SELECT '✅ cleanup_expired_data() 函数存在（应 = 1）', count(*)::int FROM pg_proc WHERE proname = 'cleanup_expired_data';
