-- 出错后清空回滚 · 一次跑完
-- 跑完这一段 → 重新打开 migrations-all-in-one.sql 整个粘贴 → Run
-- ========================================================================

-- 删表（CASCADE 自动删掉所有依赖：索引/外键/视图/policy）
DROP TABLE IF EXISTS
    textbook_chunks, textbook_files, textbook_sections,
    dialogues, attempts, student_states, misconceptions,
    questions, students, knowledge_points
CASCADE;

-- 删 function
DROP FUNCTION IF EXISTS
    kp_uuid_from_code(text),
    fsrs_due_for_student(uuid, int),
    student_overview(uuid),
    student_memory_search(uuid, vector, int, int),
    student_signal_profile(uuid),
    search_textbook_chunks(vector, text, text, smallint, int),
    takedown_textbooks(text, text),
    set_updated_at()
CASCADE;

-- 删 enum 类型
DROP TYPE IF EXISTS
    subject_enum, grade_enum, stage_enum,
    question_type_enum, question_source_enum, hint_level_enum,
    misconception_category_enum, dialogue_role_enum
CASCADE;

-- 你既有的 6 张老表（coach_conversations / pets / plan_tasks / study_plans /
-- study_sessions / users）不动，留着。

-- 跑完后看 Results 区显示 "Success"，再去 New query 粘 migrations-all-in-one.sql 重跑。
