-- 0008 · escalations 扩展 T1-T7 全分诊触发器
--
-- 顶层设计：docs/PROMPT-SYSTEM-V2-MASTER.md §4 分诊触发器 T1-T7
--
-- 在 0007 既有 5 类 kind 基础上加 3 个：
--   cross_chapter   · T3 跨章节整合（涉及 2+ 章节或学科）
--   crisis          · T6 危机信号（自伤/严重抑郁/家暴）· 最高优先级
--   out_of_scope    · T7 能力边界（偏门竞赛/地方考纲/超纲）
--
-- 完整 T1-T7 映射：
--   T1 方法论失败  → kind='concept'         priority=2 中
--   T2 概念追问    → kind='concept'         priority=2 中
--   T3 跨章节整合  → kind='cross_chapter'   priority=2 中（新加）
--   T4 长程规划    → kind='planning'        priority=3 低
--   T5 情绪挫败    → kind='emotion'         priority=1 高
--   T6 危机信号    → kind='crisis'          priority=1 最高（新加，5 分钟内人工介入）
--   T7 能力边界    → kind='out_of_scope'    priority=3 低（新加）

-- 1. 扩展 kind enum（不能在事务里加 enum value，每条独立执行）
ALTER TYPE escalation_kind_enum ADD VALUE IF NOT EXISTS 'cross_chapter';
ALTER TYPE escalation_kind_enum ADD VALUE IF NOT EXISTS 'crisis';
ALTER TYPE escalation_kind_enum ADD VALUE IF NOT EXISTS 'out_of_scope';

-- 2. 重写 priority 触发器函数，覆盖新 3 类
--    crisis 强制 priority=1（最高优先级，5 分钟内人工介入）
CREATE OR REPLACE FUNCTION fn_escalation_set_priority() RETURNS trigger AS $$
BEGIN
  IF NEW.priority IS NULL OR NEW.priority = 3 THEN
    NEW.priority := CASE NEW.kind
      WHEN 'crisis'         THEN 1   -- T6 最高 · 立即人工
      WHEN 'emotion'        THEN 1   -- T5 高
      WHEN 'concept'        THEN 2   -- T1/T2 中
      WHEN 'streak_3_wrong' THEN 2   -- 同型 3 错 中
      WHEN 'cross_chapter'  THEN 2   -- T3 中
      WHEN 'manual'         THEN 2   -- 学生显式呼叫 中
      WHEN 'planning'       THEN 3   -- T4 低
      WHEN 'out_of_scope'   THEN 3   -- T7 低
      ELSE 3
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. crisis 类型快速检索索引（人工监控用）
CREATE INDEX IF NOT EXISTS idx_escalations_crisis_pending
  ON escalations(created_at DESC)
  WHERE kind = 'crisis' AND status = 'pending';

COMMENT ON TYPE escalation_kind_enum IS 'T1-T7 全分诊：concept(T1/T2) emotion(T5) streak_3_wrong cross_chapter(T3) crisis(T6) out_of_scope(T7) planning(T4) manual';
