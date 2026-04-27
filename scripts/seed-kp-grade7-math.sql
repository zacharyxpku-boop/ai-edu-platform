-- 原点智学 · 人教版初一数学全册 KP 种子（42 条）
--
-- 配套 seed-demo-dialogues.sql / seed-demo-states.sql。
-- 之前 demo 只有第 3 章一元一次方程 7 KP，现场家长问「整式呢？几何呢？」会泄气。
-- 本份按人教版课标灌满初一上下两册全 10 章 42 KP（不含一元一次方程 7 个已有的）。
--
-- 跑法：Supabase SQL Editor 直接 paste 这整个文件运行
-- 撤销：DELETE FROM knowledge_points WHERE source = 'ontology-grade7-v1';
--
-- 设计：
--   code 命名 math.7.chN.kpM（章节 N 1-10，KP M 内章节内顺序）
--   level=4（KP 颗粒度，比 chapter level=3 细）
--   ON CONFLICT (code) DO NOTHING — 重跑安全 + 跟 demo seed 不冲突
--   source 'ontology-grade7-v1' 区分 demo-seed 的人造 KP

INSERT INTO knowledge_points (code, name, level, subject, stage, grade, source, source_id) VALUES
  -- ═══ 七年级上 ═══
  -- 第 1 章 有理数
  ('math.7.ch1.kp1', '正数与负数',         4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch1.kp1'),
  ('math.7.ch1.kp2', '数轴',               4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch1.kp2'),
  ('math.7.ch1.kp3', '绝对值与相反数',     4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch1.kp3'),
  ('math.7.ch1.kp4', '有理数加减法',       4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch1.kp4'),
  ('math.7.ch1.kp5', '有理数乘除与乘方',   4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch1.kp5'),

  -- 第 2 章 整式的加减
  ('math.7.ch2.kp1', '单项式与多项式',     4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch2.kp1'),
  ('math.7.ch2.kp2', '整式概念与次数',     4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch2.kp2'),
  ('math.7.ch2.kp3', '合并同类项',         4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch2.kp3'),
  ('math.7.ch2.kp4', '去括号与添括号',     4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch2.kp4'),

  -- 第 3 章 一元一次方程（已存在 kp1-kp7，不重复 INSERT — ON CONFLICT 兜底）

  -- 第 4 章 几何图形初步
  ('math.7.ch4.kp1', '立体图形与平面图形', 4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch4.kp1'),
  ('math.7.ch4.kp2', '直线·射线·线段',     4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch4.kp2'),
  ('math.7.ch4.kp3', '角的概念与表示',     4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch4.kp3'),
  ('math.7.ch4.kp4', '角度的度量与计算',   4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch4.kp4'),
  ('math.7.ch4.kp5', '余角·补角·对顶角',   4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch4.kp5'),

  -- ═══ 七年级下 ═══
  -- 第 5 章 相交线与平行线
  ('math.7.ch5.kp1', '相交线与邻补角',     4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch5.kp1'),
  ('math.7.ch5.kp2', '同位角·内错角·同旁内角', 4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch5.kp2'),
  ('math.7.ch5.kp3', '平行线的判定',       4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch5.kp3'),
  ('math.7.ch5.kp4', '平行线的性质',       4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch5.kp4'),
  ('math.7.ch5.kp5', '平移',               4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch5.kp5'),

  -- 第 6 章 实数
  ('math.7.ch6.kp1', '平方根·算术平方根',  4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch6.kp1'),
  ('math.7.ch6.kp2', '立方根',             4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch6.kp2'),
  ('math.7.ch6.kp3', '实数概念与分类',     4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch6.kp3'),

  -- 第 7 章 平面直角坐标系
  ('math.7.ch7.kp1', '有序数对·坐标系建立', 4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch7.kp1'),
  ('math.7.ch7.kp2', '点的坐标·象限',      4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch7.kp2'),
  ('math.7.ch7.kp3', '坐标变换·平移',      4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch7.kp3'),

  -- 第 8 章 二元一次方程组
  ('math.7.ch8.kp1', '二元一次方程组概念', 4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch8.kp1'),
  ('math.7.ch8.kp2', '代入消元法',         4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch8.kp2'),
  ('math.7.ch8.kp3', '加减消元法',         4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch8.kp3'),
  ('math.7.ch8.kp4', '方程组应用题',       4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch8.kp4'),

  -- 第 9 章 不等式与不等式组
  ('math.7.ch9.kp1', '不等式概念与性质',   4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch9.kp1'),
  ('math.7.ch9.kp2', '一元一次不等式',     4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch9.kp2'),
  ('math.7.ch9.kp3', '不等式解集·数轴表示', 4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch9.kp3'),
  ('math.7.ch9.kp4', '一元一次不等式组',   4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch9.kp4'),

  -- 第 10 章 数据的收集整理与描述
  ('math.7.ch10.kp1', '统计调查',          4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch10.kp1'),
  ('math.7.ch10.kp2', '直方图',            4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch10.kp2'),
  ('math.7.ch10.kp3', '从数据谈起',        4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'ontology-grade7-v1', 'math.7.ch10.kp3')

ON CONFLICT (code) DO NOTHING;

-- 验证：应见 36 条新增（已存在的第 3 章 7 个 + ch2 的 kp3/kp4 已 demo seed 过，部分跳过）
SELECT
    'math.7.ch' || split_part(split_part(code, '.', 3), 'ch', 2)::int AS chapter,
    count(*) AS kp_count
FROM knowledge_points
WHERE source IN ('ontology-grade7-v1', 'demo-seed')
  AND code LIKE 'math.7.%'
GROUP BY chapter
ORDER BY chapter::text;
-- 期望大致：ch1=5, ch2=4, ch3=7, ch4=5, ch5=5, ch6=3, ch7=3, ch8=4, ch9=4, ch10=3 = 总 43 条
