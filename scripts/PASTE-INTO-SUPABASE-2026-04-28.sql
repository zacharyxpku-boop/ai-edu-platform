-- 🎯 30 秒粘贴进 Supabase 一次就完事
-- 操作：
--   1. 打开 https://supabase.com/dashboard
--   2. 你的 ai-edu-platform project → 左侧菜单 SQL Editor → New query
--   3. 全选本文件内容粘贴 → Run
--   4. 看到下面 NOTICE 就成功了
--
-- 这份是 0008 (T1-T7) + 0009 (parent-push) 合并版，跑一次顶两个 migration

-- ════════════════════════════════════════════════════════════════════
-- 0008 · T1-T7 escalation 扩 enum + crisis 触发器更新
-- ════════════════════════════════════════════════════════════════════

ALTER TYPE escalation_kind_enum ADD VALUE IF NOT EXISTS 'cross_chapter';
ALTER TYPE escalation_kind_enum ADD VALUE IF NOT EXISTS 'crisis';
ALTER TYPE escalation_kind_enum ADD VALUE IF NOT EXISTS 'out_of_scope';

DO $$ BEGIN RAISE NOTICE '[1/3] T1-T7 enum 扩了 3 类完成 ✓'; END $$;

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

-- crisis 监控索引
CREATE INDEX IF NOT EXISTS idx_escalations_crisis_pending
  ON escalations(created_at DESC) WHERE kind = 'crisis' AND status = 'pending';

DO $$ BEGIN RAISE NOTICE '[2/3] crisis 触发器 + 索引完成 ✓'; END $$;

-- ════════════════════════════════════════════════════════════════════
-- 0009 · 家长 push 通知队列
-- ════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE push_trigger_kind_enum AS ENUM (
    'emotion_signals',
    'escalation_overdue',
    'weekly_brief',
    'monthly_summary',
    'crisis'
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

CREATE INDEX IF NOT EXISTS idx_pushes_kind_day
  ON parent_pushes(student_id, trigger_kind, (created_at::date));

-- 去重：同 student + 同 trigger_kind + 同北京日期只能 1 条
CREATE UNIQUE INDEX IF NOT EXISTS idx_pushes_dedup
  ON parent_pushes(student_id, trigger_kind, ((created_at AT TIME ZONE 'Asia/Shanghai')::date));

ALTER TABLE parent_pushes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_full" ON parent_pushes
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN RAISE NOTICE '[3/3] parent_pushes 表 + 去重索引完成 ✓'; END $$;

-- ════════════════════════════════════════════════════════════════════
-- 验证查询（跑完看一眼数字对得上就行）
-- ════════════════════════════════════════════════════════════════════
SELECT
  '✅ escalation_kind_enum 总值数（应 = 8）' AS check_name,
  count(*) AS value_count
FROM pg_enum WHERE enumtypid = 'escalation_kind_enum'::regtype
UNION ALL
SELECT
  '✅ parent_pushes 表存在（应 = 1）',
  count(*)::int
FROM information_schema.tables WHERE table_name = 'parent_pushes'
UNION ALL
SELECT
  '✅ push_trigger_kind_enum 总值数（应 = 5）',
  count(*)::int
FROM pg_enum WHERE enumtypid = 'push_trigger_kind_enum'::regtype;

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

DO $$ BEGIN RAISE NOTICE '[4/4] Moderation 审核表完成 ✓'; END $$;
