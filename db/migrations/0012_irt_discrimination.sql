-- =============================================================================
-- 0012 · 给 questions 表加 IRT-2PL discrimination(a) 字段
-- =============================================================================
-- 背景：bkt.js v2.0-irt2pl 用公式 P=1/(1+exp(-1.7*a*(mastery-b)))，每道题需要
--       独立的 a 值（discrimination/区分度）。原 schema 没这字段，所有题 a=1
--       默认，IRT 等于退化成 1PL，mastery 曲线没说服力（FINAL-AUDIT 翻车点 #5）。
--
-- 设计：
--   1. 加 discrimination 列，范围 [0.3, 2.5]（IRT 文献经典区间）
--   2. 启发式回填：a = 1.0 + 0.8 * (1 - 4*(difficulty-0.5)^2)
--      - difficulty=0.5（中等题）→ a=1.8（最有区分度，能拉开会与不会）
--      - difficulty=0.1 / 0.9（极易/极难题）→ a=1.0（区分度低，所有人都对/错）
--      - 这是 IRT 实证常识：极端难度题信号弱
--   3. 缺 difficulty 的题 → a=1.0 兜底
--
-- 执行：
--   psql 跑这个 migration 或粘进 Supabase SQL Editor，幂等可重跑
--   跑完看下面 NOTICE 数字
-- =============================================================================

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS discrimination numeric(3,2)
    CHECK (discrimination IS NULL OR (discrimination >= 0.3 AND discrimination <= 2.5));

COMMENT ON COLUMN questions.discrimination IS
  'IRT-2PL 区分度参数(a) · 0.3~2.5 · 中等难度题 a 高(信号强), 极端难度题 a 低(信号弱)';

CREATE INDEX IF NOT EXISTS idx_questions_irt
  ON questions(difficulty, discrimination)
  WHERE is_active = true;

-- 启发式回填：对所有 discrimination IS NULL 且有 difficulty 的题
-- 公式：a = round(1.0 + 0.8 * (1 - 4 * (d - 0.5)^2), 2)
-- difficulty=0.50 → a=1.80   (最区分)
-- difficulty=0.30 → a=1.48   (略偏易但区分仍可)
-- difficulty=0.70 → a=1.48
-- difficulty=0.10 → a=1.06   (极易，区分弱)
-- difficulty=0.90 → a=1.06   (极难，区分弱)
-- 加 ±0.1 微扰让 demo 题不至于完全均匀
UPDATE questions
   SET discrimination = ROUND(
         GREATEST(0.30, LEAST(2.50,
           1.0 + 0.8 * (1.0 - 4.0 * (difficulty - 0.5) * (difficulty - 0.5))
              + (random() - 0.5) * 0.2
         ))::numeric, 2
       )
 WHERE discrimination IS NULL
   AND difficulty IS NOT NULL;

-- 没 difficulty 的题给中等区分度 + 微扰
UPDATE questions
   SET discrimination = ROUND((1.0 + (random() - 0.5) * 0.6)::numeric, 2)
 WHERE discrimination IS NULL;

DO $$
DECLARE
  filled int;
  null_left int;
  avg_a numeric;
  min_a numeric;
  max_a numeric;
BEGIN
  SELECT count(*) INTO filled FROM questions WHERE discrimination IS NOT NULL;
  SELECT count(*) INTO null_left FROM questions WHERE discrimination IS NULL;
  SELECT round(avg(discrimination), 2), min(discrimination), max(discrimination)
    INTO avg_a, min_a, max_a
    FROM questions WHERE discrimination IS NOT NULL;
  RAISE NOTICE '[0012] discrimination 已填: %, 仍 NULL: %, 范围 % ~ %, 平均 %',
    filled, null_left, min_a, max_a, avg_a;
END $$;
