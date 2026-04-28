-- 0007 · escalations 表 · 清北异步攻坚队列
--
-- 顶层设计：docs/CHINESE-FAMILY-AI-MANAGER-V1.md 三档分诊
--   档 1 熟练度 · AI 自己引导（80%）
--   档 2 概念性 · 转清北（15%，触发 escalation kind='concept'）
--   档 3 情绪 · 切陪伴 + 累计触发清北（5%，kind='emotion'）
--   特殊：同型 3 次错（kind='streak_3_wrong'）/ 长程规划（kind='planning'）/ 学生显式呼叫（kind='manual'）
--
-- B 模式核心机制：每条 escalation 自带 context 弹药，清北哥哥点开 30 秒入戏，
-- 不需要重新摸底。这把 1v1 同步的人工辅导压成 1v3 异步攻坚，单老师 LTV 提 3-4 倍。

CREATE TYPE escalation_kind_enum AS ENUM (
  'concept',          -- 概念性问题（AI 易胡说，转清北）
  'emotion',          -- 情绪信号 ≥2 次（焦虑/无力/否定自我）
  'streak_3_wrong',   -- 同型题连续 3 次错（熟练度过 BKT 阈值）
  'planning',         -- 长程规划（选科/中考策略/学习路径）
  'manual'            -- 学生显式点「呼叫清北」按钮
);

CREATE TYPE escalation_status_enum AS ENUM (
  'pending',          -- 已入队，未认领
  'claimed',          -- 清北哥哥认领中
  'resolved',         -- 已回复
  'cancelled'         -- 取消（学生改主意 / 超时无人接 / 系统判定）
);

CREATE TABLE IF NOT EXISTS escalations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  dialogue_id          uuid REFERENCES dialogues(id) ON DELETE SET NULL,    -- 触发的对话（可选）
  topic_code           text,                                                -- 关联 KP（math.7.ch3.kp3 等）
  kind                 escalation_kind_enum NOT NULL,
  status               escalation_status_enum NOT NULL DEFAULT 'pending',
  student_message      text NOT NULL,                                       -- 孩子原话（最长 2000 字）
  context              jsonb NOT NULL DEFAULT '{}'::jsonb,                  -- 给清北看的弹药包
                                                                            -- {question, attempts, recent_signals, mastery_score, conversation_excerpt}
  ai_summary           text,                                                -- AI 一句话给清北的「这孩子是谁，卡哪」
  priority             smallint NOT NULL DEFAULT 3,                         -- 1=高（情绪危机）/ 2=中 / 3=低
  assigned_mentor_id   uuid,                                                -- 清北哥哥 id（mentors 表后续建）
  expected_response_minutes int NOT NULL DEFAULT 30,                        -- 承诺响应时间
  created_at           timestamptz NOT NULL DEFAULT now(),
  claimed_at           timestamptz,
  resolved_at          timestamptz,
  resolution_kind      text,                                                -- 'text' | 'screen_record' | 'voice_call' | 'video_call'
  resolution_content   text,                                                -- 回复正文（如果文字回复）/ 录屏链接 / 通话纪要
  resolution_minutes   int,                                                 -- 实际响应时间（resolved_at - created_at）
  student_rating       smallint,                                            -- 1-5 学生满意度
  meta                 jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_escalations_student ON escalations(student_id, created_at DESC);
CREATE INDEX idx_escalations_pending ON escalations(status, priority, created_at) WHERE status = 'pending';
CREATE INDEX idx_escalations_mentor ON escalations(assigned_mentor_id, status) WHERE assigned_mentor_id IS NOT NULL;
CREATE INDEX idx_escalations_kind_time ON escalations(kind, created_at DESC);

-- RLS：学生只能看自己的、清北能看分配给自己的
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

-- service_role bypass（后端用 service key）
CREATE POLICY "service_role_full" ON escalations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 学生本人 read（前端 anon key 走，需要 supabase auth.uid() 对应 students.auth_user_id）
CREATE POLICY "student_own_read" ON escalations
  FOR SELECT TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE auth_user_id = auth.uid()
    )
  );

-- 触发器：写入时自动算 priority（kind=emotion → 1 高 / kind=concept → 2 中 / 其他 → 3 低）
CREATE OR REPLACE FUNCTION fn_escalation_set_priority() RETURNS trigger AS $$
BEGIN
  IF NEW.priority IS NULL OR NEW.priority = 3 THEN
    NEW.priority := CASE NEW.kind
      WHEN 'emotion' THEN 1
      WHEN 'concept' THEN 2
      WHEN 'streak_3_wrong' THEN 2
      WHEN 'planning' THEN 3
      WHEN 'manual' THEN 2
      ELSE 3
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_escalation_set_priority
  BEFORE INSERT ON escalations
  FOR EACH ROW EXECUTE FUNCTION fn_escalation_set_priority();

-- 触发器：resolved_at set 时自动算 resolution_minutes
CREATE OR REPLACE FUNCTION fn_escalation_calc_minutes() RETURNS trigger AS $$
BEGIN
  IF NEW.resolved_at IS NOT NULL AND OLD.resolved_at IS NULL THEN
    NEW.resolution_minutes := EXTRACT(EPOCH FROM (NEW.resolved_at - NEW.created_at)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_escalation_calc_minutes
  BEFORE UPDATE ON escalations
  FOR EACH ROW EXECUTE FUNCTION fn_escalation_calc_minutes();

COMMENT ON TABLE escalations IS '清北异步攻坚队列 · B 模式核心机制 · 把 1v1 同步压成 1v3 异步';
COMMENT ON COLUMN escalations.context IS '弹药包 JSONB · 让清北 30 秒入戏 · {question, attempts[], recent_signals, mastery, conversation_excerpt}';
COMMENT ON COLUMN escalations.ai_summary IS 'AI 一句话给清北的预读 · 例：「初一小米在『分式去分母』第 3 步卡，问『为什么两边要同时乘』，需要概念性讲解」';
