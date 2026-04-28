-- 0009 · parent_pushes 表 · 家长 push 通道（4 类触发器 + crisis）
--
-- 顶层设计：docs/CHINESE-FAMILY-AI-MANAGER-V1.md
--   家长省心放心 = 省心（AI 自动维护错题本/计划/监督） + 放心（关键时刻 push 通知）
--   parent-brief 是被动接收（家长打开 parent-radar 才看到）。
--   parent-pushes 是主动 push——关键时刻发到家长手机。
--
-- 4 类触发器（cron 每小时扫一遍）：
--   1) emotion_signals     · 情绪信号 ≥ 2 次/24h        · priority=3
--   2) escalation_overdue  · 学长 escalation > 60min 未认领 · priority=2
--   3) weekly_brief        · 周日 19:00 周报 ready        · priority=3
--   4) monthly_summary     · 每月 1 日 9:00 月度对比      · priority=3
--   特殊：crisis           · T6 危机信号（最高优先级，立即 push）· priority=1
--
-- 去重铁律：同 student + 同 trigger_kind + 同天 只能 1 条（unique index）
-- 防止 cron 重复触发刷屏家长。

CREATE TYPE push_trigger_kind_enum AS ENUM (
  'emotion_signals',     -- 情绪信号 ≥ 2 次/24h
  'escalation_overdue',  -- 学长 escalation > 60min 未认领
  'weekly_brief',        -- 周日 19:00 周报 ready
  'monthly_summary',     -- 每月 1 日 9:00 月度对比
  'crisis'               -- T6 危机信号（最高优先级）
);

CREATE TYPE push_status_enum AS ENUM (
  'pending',  -- 已生成，未发送
  'sent',     -- 已发送（PWA/微信成功）
  'read',     -- 家长已读
  'failed'    -- 发送失败
);

CREATE TABLE IF NOT EXISTS parent_pushes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  trigger_kind    push_trigger_kind_enum NOT NULL,
  title           text NOT NULL,                                 -- push 标题（≤ 50 字）
  body            text NOT NULL,                                 -- push 正文（≤ 200 字）
  deeplink        text,                                          -- 点击跳转：/parent-radar?student_id=...
  priority        smallint NOT NULL DEFAULT 3,                   -- 1=crisis, 2=high, 3=normal, 4=low
  status          push_status_enum NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,                                   -- 真发送时间（demo 期保持 NULL）
  read_at         timestamptz,                                   -- 家长在 parent-radar 点开时刻
  meta            jsonb DEFAULT '{}'::jsonb                      -- {trigger_evidence:..., escalation_id:...}
);

-- 家长 parent-radar 顶部「🔔 N 条新通知」徽章读这个：
CREATE INDEX idx_pushes_student_unread ON parent_pushes(student_id, created_at DESC)
  WHERE status IN ('pending', 'sent');

-- 按 student + kind + 天 分桶查询（去重检查、运营 dashboard）：
CREATE INDEX idx_pushes_kind_day ON parent_pushes(student_id, trigger_kind, ((created_at AT TIME ZONE 'Asia/Shanghai')::date));

-- 同 student + 同 kind + 同天 只允许 1 条 → 防 cron 重刷屏：
CREATE UNIQUE INDEX idx_pushes_dedup ON parent_pushes(
  student_id,
  trigger_kind,
  ((created_at AT TIME ZONE 'Asia/Shanghai')::date)
);

-- ----------------------------------------------------------------------------
-- RLS：service_role 全权（cron + 后端 API 用 service key），其他 role 默认拒
-- ----------------------------------------------------------------------------
ALTER TABLE parent_pushes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full" ON parent_pushes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 注：家长侧目前还没建独立 auth 角色（demo 期 parent-radar 走 anon + student_id），
-- 上线后家长 read policy 单独补 0010_parent_pushes_rls.sql
