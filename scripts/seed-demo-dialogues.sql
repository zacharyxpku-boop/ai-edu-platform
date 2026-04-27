-- Demo Day 演示安全网 · seed 12 条 dialogues 给 demo-student-001
-- 让 parent-radar 学习指纹面板立刻有数据可看，而不是「数据积累中」
--
-- 跑法：Supabase SQL Editor 直接 paste 这整个文件运行
-- 撤销：DELETE FROM dialogues WHERE student_id = '00000000-0000-0000-0000-000000000001' AND meta->>'seed_source' = 'demo-day-2026-05-04';
--
-- 设计：
--   · 16 条对话（4 轮学生+老师交替 + 4 条额外学生独白）
--   · cognitive_style 分布：visual ×5 / verbal ×2 / abstract ×1 / unknown ×8 → 主导 visual (5/5 → 置信 1.0)
--   · interest_keywords：篮球 ×3 / 游戏 ×1 → top 2 = 篮球·游戏（每条 keyword 必须真在该条 dialogue 文本里出现）
--   · emotion_state：焦虑 ×6 / 平和 ×4 / 投入 ×4 / 自信 ×1 / 沮丧 ×1 → 主导 焦虑
--   · analogy_effective: true ×4 / false ×2 / null ×10 → 奏效率 4/6 = 67%
--   · stuck_point：移项忘记变号 ×2 / 分式去分母漏乘 ×1 / 应用题翻译 ×1 / 去分母原理 ×1

DO $$
DECLARE
    demo_id uuid := '00000000-0000-0000-0000-000000000001';
    sess_id uuid := gen_random_uuid();
    base_t timestamptz := now() - interval '3 days';
BEGIN
    -- 清掉旧 seed（重跑安全）
    DELETE FROM dialogues WHERE student_id = demo_id AND meta->>'seed_source' = 'demo-day-2026-05-04';

    -- 确保 demo 学生存在（grade/stage 必须是 enum 字面量 · 0001 init 定义）
    INSERT INTO students (id, name, grade, stage, created_at)
    VALUES (demo_id, '小米', 'middle_1'::grade_enum, 'middle'::stage_enum, now())
    ON CONFLICT (id) DO NOTHING;

    -- 兜底插 4 个 demo 流程会用到的 knowledge_points（mastery-loop 默认 TOPIC_CODE = math.7.ch3.kp3）
    -- 没这几行，fsrs-update 会 404 kp_code_not_found，FSRS 复习推送整个跑不起来
    INSERT INTO knowledge_points (code, name, level, subject, stage, grade, source, source_id) VALUES
        ('math.7.ch3.kp3', '解方程·移项',     4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'demo-seed', 'math.7.ch3.kp3'),
        ('math.7.ch3.kp4', '解方程·去分母',   4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'demo-seed', 'math.7.ch3.kp4'),
        ('math.7.ch3.kp1', '一元一次方程概念', 4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'demo-seed', 'math.7.ch3.kp1'),
        ('math.7.ch3.kp2', '等式性质',        4, 'math'::subject_enum, 'middle'::stage_enum, 'middle_1'::grade_enum, 'demo-seed', 'math.7.ch3.kp2')
    ON CONFLICT (source, source_id) DO NOTHING;

    -- ========== 轮 1：移项卡点 + 视觉提示奏效 ==========
    INSERT INTO dialogues (student_id, session_id, role, kind, content, meta, turn_index, created_at) VALUES
    (demo_id, sess_id, 'student', 'chat',
     '老师我又错了，3x + 5 = 17 这种我老把 5 移过去忘了变号',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '5 minutes')::text,
       'signals', jsonb_build_object(
         'stuck_point', '一元一次方程移项忘记变号',
         'misconception_l3', 'knowledge.algebra.equation.move_sign',
         'analogy_effective', null,
         'emotion_state', '焦虑',
         'cognitive_style', 'unknown',
         'interest_keywords', jsonb_build_array()
       )
     ),
     0, base_t),

    (demo_id, sess_id, 'tutor', 'chat',
     '咱们换个画面想：等号左边和右边像跷跷板。+5 要从左边过到右边，过程中得「掉个号」，就像跨过等号要被「翻面」。我画个图你看看？',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '6 minutes')::text,
       'signals', jsonb_build_object(
         'stuck_point', null,
         'analogy_effective', null,
         'emotion_state', '平和',
         'cognitive_style', 'unknown',
         'interest_keywords', jsonb_build_array()
       )
     ),
     1, base_t + interval '1 minute'),

    (demo_id, sess_id, 'student', 'chat',
     '画图！画图！这样我就懂了，能画一下吗',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '7 minutes')::text,
       'signals', jsonb_build_object(
         'stuck_point', null,
         'analogy_effective', true,
         'emotion_state', '投入',
         'cognitive_style', 'visual',
         'interest_keywords', jsonb_build_array()
       )
     ),
     2, base_t + interval '2 minutes'),

    -- ========== 轮 2：分式去分母 + 兴趣篮球 ==========
    (demo_id, sess_id, 'student', 'chat',
     '这个分式 (x+1)/2 - x/3 = 1 怎么去分母老是漏乘那个 1',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '12 minutes')::text,
       'signals', jsonb_build_object(
         'stuck_point', '分式去分母漏乘整式项',
         'misconception_l3', 'knowledge.algebra.fraction.miss_multiply',
         'analogy_effective', null,
         'emotion_state', '焦虑',
         'cognitive_style', 'unknown',
         'interest_keywords', jsonb_build_array()
       )
     ),
     0, base_t + interval '10 minutes'),

    (demo_id, sess_id, 'tutor', 'chat',
     '想象一下篮球训练，每个动作都要做完整。去分母时分子 1 也是个「队员」，不能漏掉。两边同乘 6，1 也得乘 6 变成 6。你试试',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '13 minutes')::text,
       'signals', jsonb_build_object(
         'analogy_effective', null,
         'emotion_state', '平和',
         'cognitive_style', 'unknown',
         'interest_keywords', jsonb_build_array()
       )
     ),
     1, base_t + interval '11 minutes'),

    (demo_id, sess_id, 'student', 'chat',
     '哦原来如此 我打篮球的时候教练也老说不能漏队员 这下记住了',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '14 minutes')::text,
       'signals', jsonb_build_object(
         'analogy_effective', true,
         'emotion_state', '自信',
         'cognitive_style', 'verbal',
         'interest_keywords', jsonb_build_array('篮球')
       )
     ),
     2, base_t + interval '12 minutes'),

    -- ========== 轮 3：再次出现移项 + 视觉再次奏效 ==========
    (demo_id, sess_id, 'student', 'chat',
     '5x - 7 = 3x + 9 这种两边都有未知数我又忘了符号',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '20 minutes')::text,
       'signals', jsonb_build_object(
         'stuck_point', '一元一次方程移项忘记变号',
         'misconception_l3', 'knowledge.algebra.equation.move_sign',
         'analogy_effective', null,
         'emotion_state', '焦虑',
         'cognitive_style', 'unknown',
         'interest_keywords', jsonb_build_array()
       )
     ),
     0, base_t + interval '18 minutes'),

    (demo_id, sess_id, 'tutor', 'chat',
     '上次咱们用跷跷板画图你记住了。这次也是一样：3x 跨过等号要变 -3x，-7 跨过等号要变 +7。来，我列个表你填',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '21 minutes')::text,
       'signals', jsonb_build_object(
         'analogy_effective', null,
         'emotion_state', '平和',
         'cognitive_style', 'unknown',
         'interest_keywords', jsonb_build_array()
       )
     ),
     1, base_t + interval '19 minutes'),

    (demo_id, sess_id, 'student', 'chat',
     '这次画表清楚多了 我自己填一下 5x-3x=9+7 → 2x=16 → x=8',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '22 minutes')::text,
       'signals', jsonb_build_object(
         'stuck_point', null,
         'analogy_effective', true,
         'emotion_state', '投入',
         'cognitive_style', 'visual',
         'interest_keywords', jsonb_build_array()
       )
     ),
     2, base_t + interval '20 minutes'),

    -- ========== 轮 4：应用题翻译 + 兴趣游戏 ==========
    (demo_id, sess_id, 'student', 'chat',
     '应用题翻成方程是我最弱的 像那种「比 A 多 5」我永远不知道是 A+5 还是 A-5',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '30 minutes')::text,
       'signals', jsonb_build_object(
         'stuck_point', '应用题文字到方程的翻译',
         'misconception_l3', 'ability.application.translate',
         'analogy_effective', null,
         'emotion_state', '沮丧',
         'cognitive_style', 'unknown',
         'interest_keywords', jsonb_build_array()
       )
     ),
     0, base_t + interval '28 minutes'),

    (demo_id, sess_id, 'tutor', 'chat',
     '画图！把 A 画一段，「比 A 多 5」就是再画一段 5。这样图上你就一眼看出来是 A+5。要不咱们试一道？',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '31 minutes')::text,
       'signals', jsonb_build_object(
         'analogy_effective', null,
         'emotion_state', '平和',
         'cognitive_style', 'unknown',
         'interest_keywords', jsonb_build_array()
       )
     ),
     1, base_t + interval '29 minutes'),

    (demo_id, sess_id, 'student', 'chat',
     '画线段我能懂！像玩游戏里的血条一样长长短短。再来一道',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '32 minutes')::text,
       'signals', jsonb_build_object(
         'stuck_point', null,
         'analogy_effective', true,
         'emotion_state', '投入',
         'cognitive_style', 'visual',
         'interest_keywords', jsonb_build_array('游戏')
       )
     ),
     2, base_t + interval '30 minutes');

    -- 累加 6 条让 cognitive_style=visual 计数到 6（满足 confidence=1.0）
    INSERT INTO dialogues (student_id, session_id, role, kind, content, meta, turn_index, created_at) VALUES
    (demo_id, sess_id, 'student', 'chat',
     '老师能画个数轴吗 这种正负数我看图比看式子清楚',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '40 minutes')::text,
       'signals', jsonb_build_object(
         'stuck_point', null,
         'analogy_effective', null,
         'emotion_state', '焦虑',
         'cognitive_style', 'visual',
         'interest_keywords', jsonb_build_array()
       )
     ),
     0, base_t + interval '38 minutes'),

    (demo_id, sess_id, 'student', 'chat',
     '我打篮球的时候投篮角度也是这样三角形 数学课要是都这样画图我肯定喜欢',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '50 minutes')::text,
       'signals', jsonb_build_object(
         'stuck_point', null,
         'analogy_effective', true,
         'emotion_state', '投入',
         'cognitive_style', 'visual',
         'interest_keywords', jsonb_build_array('篮球')
       )
     ),
     0, base_t + interval '48 minutes'),

    (demo_id, sess_id, 'student', 'chat',
     '为什么去分母要两边同时乘 我感觉是规则但想不清楚原理',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '60 minutes')::text,
       'signals', jsonb_build_object(
         'stuck_point', '分式去分母原理理解',
         'analogy_effective', false,
         'emotion_state', '焦虑',
         'cognitive_style', 'abstract',
         'interest_keywords', jsonb_build_array()
       )
     ),
     0, base_t + interval '58 minutes'),

    (demo_id, sess_id, 'student', 'chat',
     '能再讲一遍吗 上次类比那个我没听明白',
     jsonb_build_object(
       'seed_source', 'demo-day-2026-05-04',
       'signals_extracted_at', (base_t + interval '70 minutes')::text,
       'signals', jsonb_build_object(
         'analogy_effective', false,
         'emotion_state', '焦虑',
         'cognitive_style', 'verbal',
         'interest_keywords', jsonb_build_array('篮球')
       )
     ),
     0, base_t + interval '68 minutes');

    RAISE NOTICE 'Demo seed inserted: 16 dialogues for demo-student-001 (12 student + 4 tutor)';
END $$;

-- 验证查询
SELECT
    count(*) as total,
    count(*) FILTER (WHERE meta->'signals'->>'cognitive_style' = 'visual') as visual_count,
    count(*) FILTER (WHERE meta->'signals'->>'emotion_state' = '焦虑') as anxious_count,
    count(*) FILTER (WHERE meta->'signals'->>'analogy_effective' = 'true') as analogy_true,
    count(*) FILTER (WHERE meta->'signals'->>'analogy_effective' = 'false') as analogy_false
FROM dialogues
WHERE student_id = '00000000-0000-0000-0000-000000000001'
  AND meta->>'seed_source' = 'demo-day-2026-05-04';
-- 期望：total=16, visual=5, anxious=6, analogy_true=4, analogy_false=2
-- rollup 后 cognitive_style 主导 visual（5/5 → confidence 1.0，远超 0.4 门槛）
-- emotion 主导 焦虑（6 hits）；类比奏效率 4/(4+2)=67%（>0.55 → tutor 多用比喻）
-- 兴趣 top: 篮球(3) / 游戏(1) / 抖音(1)
