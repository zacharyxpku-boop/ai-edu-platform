-- 0010 · moderation_logs 表 · 不当内容审核层（Khanmigo 5.5 安全机制对齐）
--
-- 顶层设计：docs/CHINESE-FAMILY-AI-MANAGER-V1.md 安全审核域
--   T6 escalations 只覆盖学生说严重伤害自己的话（crisis）。
--   moderation_logs 补全 Khanmigo 5.5 三件套缺的剩余两件：
--     - 学生侧：脏话 / 跑题 / 作弊 / 暴力色情
--     - AI  侧：hallucination / policy_violation（v3 prompt 全局禁词出口）
--
-- 设计意图：不是审查（直接拦截屏蔽），是 记录 + 分级 + 必要时上报。
--   学生骂句脏话不该被屏蔽（孩子的真实情绪），但要被记录让家长/学长看到。
--   AI 输出疑似 hallucination 要被检测（prompt 工程改进的反馈信号）。
--
-- 6 类 flag category：
--   profanity        · 脏话（学生侧）
--   harm             · 自伤 / 暴力（学生侧 · 直接 escalate kind=crisis）
--   adult            · 色情 / 不当内容（学生侧）
--   misinformation   · AI hallucination（tutor 侧）
--   off_topic        · 严重跑题（学生侧）
--   cheating         · 直接要答案（学生侧）
--
-- verdict 4 档：
--   clean    · 纯净，仅 logged
--   flag     · 命中但不阻塞（severity 1-3）
--   block    · 阻断（仅 tutor 侧 hallucination ≥ 4 · 当前版本 暂不实现，留 flag）
--   escalate · 强制上报学长/家长（severity ≥ 4 · 自动调 /api/escalate）

CREATE TYPE moderation_verdict_enum AS ENUM (
  'clean',     -- 纯净，仅 log
  'flag',      -- 命中但不阻塞（学生骂脏话/AI 出禁词）
  'block',     -- 阻断（保留枚举，当前版本暂不实现）
  'escalate'   -- 强制上报（severity ≥ 4 → 调 /api/escalate）
);

CREATE TABLE IF NOT EXISTS moderation_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid REFERENCES students(id) ON DELETE CASCADE,
  dialogue_id     uuid REFERENCES dialogues(id) ON DELETE SET NULL,
  role            text NOT NULL,                            -- 'student' | 'tutor'
  content_excerpt text NOT NULL,                            -- 不存全文，只截前 500 字
  verdict         moderation_verdict_enum NOT NULL,
  flags           jsonb DEFAULT '[]'::jsonb,                -- [{category, severity, snippet}]
  actions_taken   text[] DEFAULT '{}',                      -- ['logged', 'alert_parent', 'block_response']
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- 学生最近审核流（学长侧 mentor 工单可一眼看「该生过去 7 天有 3 次脏话」）
CREATE INDEX idx_mod_student_recent ON moderation_logs(student_id, created_at DESC);

-- 高 severity 时间线（运营 dashboard 看「今天有几条 escalate / flag」）
CREATE INDEX idx_mod_severity ON moderation_logs(verdict, created_at DESC)
  WHERE verdict IN ('flag', 'block', 'escalate');

-- ----------------------------------------------------------------------------
-- RLS：service_role 全权（API 走 service key），其他 role 默认拒
-- ----------------------------------------------------------------------------
ALTER TABLE moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full" ON moderation_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
