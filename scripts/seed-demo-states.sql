-- 原点智学 · Demo 学生 student_states 种子（补 BKT/FSRS 数据）
--
-- 跟 seed-demo-dialogues.sql 配套：dialogues 给跨会话记忆 + 信号指纹，
-- 这份给 mastery 进度条 + 下次复习时间，让 tutor.html 右栏 / mastery-loop / parent-radar
-- 三处 KP 状态显示从 hardcode 占位换成真库数据。
--
-- 跑法：Supabase SQL Editor 直接 paste 运行
-- 撤销：DELETE FROM student_states WHERE student_id = '00000000-0000-0000-0000-000000000001';
--
-- 设计：4 个 KP 4 个梯度
--   kp1 一元一次方程概念  → 0.92  done   ✓ 最近练 5 天前  下次复习 6 天后
--   kp2 等式性质         → 0.85  done   ✓ 最近练 4 天前  下次复习 5 天后
--   kp3 解方程·移项       → 0.62  active ●  最近练 1 小时前 下次复习 1 天后
--   kp4 解方程·去分母     → 0.18  待练   ○  最近练 2 天前   下次复习 立即
--
-- 这样 demo 一打开 tutor 右栏：
--   · 现在练「解方程·移项」掌握度 0.62（橙色 active）
--   · 最近卡点真从 dialogues meta.signals.stuck_point 聚合
--   · 下次复习「明天 19:00 · 去分母 复习题 3 道」（next_review_at 推算）

DO $$
DECLARE
    demo_id  uuid := '00000000-0000-0000-0000-000000000001';
    kp1_id   uuid;
    kp2_id   uuid;
    kp3_id   uuid;
    kp4_id   uuid;
BEGIN
    -- 拿 4 个 KP 的 UUID（前置：seed-demo-dialogues.sql 已 INSERT 这 4 行）
    SELECT id INTO kp1_id FROM knowledge_points WHERE code = 'math.7.ch3.kp1';
    SELECT id INTO kp2_id FROM knowledge_points WHERE code = 'math.7.ch3.kp2';
    SELECT id INTO kp3_id FROM knowledge_points WHERE code = 'math.7.ch3.kp3';
    SELECT id INTO kp4_id FROM knowledge_points WHERE code = 'math.7.ch3.kp4';

    -- 任一 KP 未找到 → 抛错而不是静默跳过（demo 现场宁可早死也别现 bug）
    IF kp1_id IS NULL OR kp2_id IS NULL OR kp3_id IS NULL OR kp4_id IS NULL THEN
        RAISE EXCEPTION '前置 KP 缺失：先跑 seed-demo-dialogues.sql 把 4 个 math.7.ch3 KP 落库';
    END IF;

    -- 清旧 seed（重跑安全 · 这里没用 meta seed_source 标记是因为 student_states 没 meta 列，
    -- 直接按 demo_id 全清；真用户档案不会用 demo_id 所以不冲突）
    DELETE FROM student_states WHERE student_id = demo_id;

    -- ==== KP1 一元一次方程概念 · 已掌握 ====
    INSERT INTO student_states (student_id, knowledge_point_id, mastery_score,
        model_name, model_version, confidence,
        attempts_count, correct_count,
        last_practiced_at, next_review_at, fsrs_state)
    VALUES (demo_id, kp1_id, 0.920,
        'bkt', 'v1.0', 0.85,
        12, 11,
        now() - interval '5 days', now() + interval '6 days',
        jsonb_build_object('stability', 8.5, 'difficulty', 4.2, 'retrievability', 0.93));

    -- ==== KP2 等式性质 · 已掌握 ====
    INSERT INTO student_states (student_id, knowledge_point_id, mastery_score,
        model_name, model_version, confidence,
        attempts_count, correct_count,
        last_practiced_at, next_review_at, fsrs_state)
    VALUES (demo_id, kp2_id, 0.850,
        'bkt', 'v1.0', 0.78,
        10, 9,
        now() - interval '4 days', now() + interval '5 days',
        jsonb_build_object('stability', 7.1, 'difficulty', 4.8, 'retrievability', 0.88));

    -- ==== KP3 解方程·移项 · 攻克中 ====
    INSERT INTO student_states (student_id, knowledge_point_id, mastery_score,
        model_name, model_version, confidence,
        attempts_count, correct_count,
        last_practiced_at, next_review_at, fsrs_state)
    VALUES (demo_id, kp3_id, 0.620,
        'bkt', 'v1.0', 0.72,
        8, 5,
        now() - interval '1 hour', now() + interval '1 day',
        jsonb_build_object('stability', 1.8, 'difficulty', 6.5, 'retrievability', 0.71));

    -- ==== KP4 解方程·去分母 · 待练（FSRS 推到立即复习）====
    INSERT INTO student_states (student_id, knowledge_point_id, mastery_score,
        model_name, model_version, confidence,
        attempts_count, correct_count,
        last_practiced_at, next_review_at, fsrs_state)
    VALUES (demo_id, kp4_id, 0.180,
        'bkt', 'v1.0', 0.55,
        3, 1,
        now() - interval '2 days', now() - interval '6 hours',
        jsonb_build_object('stability', 0.4, 'difficulty', 7.8, 'retrievability', 0.32));

    RAISE NOTICE 'student_states seeded for demo-001: 4 KPs (done=2, active=1, due=1)';
END $$;

-- 验证查询
SELECT
    kp.code,
    kp.name,
    ss.mastery_score,
    ss.attempts_count || '/' || ss.correct_count as att_correct,
    to_char(ss.last_practiced_at, 'MM-DD HH24:MI') as last_practiced,
    to_char(ss.next_review_at, 'MM-DD HH24:MI') as next_review,
    CASE
        WHEN ss.mastery_score >= 0.85 THEN '已掌握 ✓'
        WHEN ss.mastery_score >= 0.5  THEN '攻克中 ●'
        ELSE                                '待补 ○'
    END as stage
FROM student_states ss
JOIN knowledge_points kp ON kp.id = ss.knowledge_point_id
WHERE ss.student_id = '00000000-0000-0000-0000-000000000001'
ORDER BY kp.code;
-- 期望 4 行：kp1=0.92 已掌握, kp2=0.85 已掌握, kp3=0.62 攻克中, kp4=0.18 待补
