-- ========================================================================
-- Migration 0003 · Row Level Security 策略
-- ========================================================================
-- anon key 在前端公开可见，必须靠 RLS 保证安全。
--
-- 角色拆分：
--   anon          匿名（前端 mastery-loop / parent-radar 默认身份）
--   authenticated 已登录学生（用 Supabase Auth 注册后）
--   service_role  服务端（NCDM 训练 / admin 看板 / Edge functions）
--
-- 安全策略（默认拒绝 + 最小授权）：
--   1. 所有表先开 RLS，不写 policy 即拒绝
--   2. anon 只能写 attempts / dialogues（自己的学生 ID 关联）
--   3. authenticated 能读自己的 student_states / attempts
--   4. service_role 全部权限（绕过 RLS）
--   5. 教材 / 知识点 / 题目这些公共数据 anon 可读
-- ========================================================================

-- ----------- 1. 开启所有表的 RLS -----------
ALTER TABLE students         ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_states   ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE dialogues        ENABLE ROW LEVEL SECURITY;
ALTER TABLE misconceptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE textbook_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE textbook_files   ENABLE ROW LEVEL SECURITY;
ALTER TABLE textbook_chunks  ENABLE ROW LEVEL SECURITY;


-- ----------- 2. 公共数据：anon + authenticated 可读 -----------
CREATE POLICY "公共题目所有人可读"
    ON questions FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "知识点所有人可读"
    ON knowledge_points FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "教材章节所有人可读"
    ON textbook_sections FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "misconception 标签所有人可读"
    ON misconceptions FOR SELECT
    TO anon, authenticated
    USING (true);

-- 教材文件 + chunks 不允许 anon 直接 SELECT（避免 storage_path 泄露）
CREATE POLICY "教材文件仅 service_role 可读"
    ON textbook_files FOR SELECT
    TO authenticated
    USING (deleted_at IS NULL);


-- ----------- 3. 学生身份隔离 -----------
-- anon 用 student_id 做 X-Yuandian-Student 头识别（PoC 期间，Auth 后续接）
-- 生产建议升级用 Supabase Auth + auth.uid() 关联 students.auth_uid

-- students 表：anon 只能 SELECT 自己（通过 X-Yuandian-Student 比 cookie 简单）
CREATE POLICY "学生只能读自己的档案"
    ON students FOR SELECT
    TO authenticated
    USING (auth_user_id = auth.uid());

-- attempts 表：anon 可以 INSERT（写题日志），但只能 SELECT 自己的
CREATE POLICY "学生写题日志（anon allow insert）"
    ON attempts FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "学生只能读自己的答题"
    ON attempts FOR SELECT
    TO authenticated
    USING (
        student_id IN (SELECT id FROM students WHERE auth_user_id = auth.uid())
    );

-- student_states：只能读自己的 mastery 向量
CREATE POLICY "学生只能读自己的 state"
    ON student_states FOR SELECT
    TO authenticated
    USING (
        student_id IN (SELECT id FROM students WHERE auth_user_id = auth.uid())
    );

-- dialogues：anon 可写，只能读自己
CREATE POLICY "对话日志可写"
    ON dialogues FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

CREATE POLICY "对话日志只能读自己"
    ON dialogues FOR SELECT
    TO authenticated
    USING (
        student_id IN (SELECT id FROM students WHERE auth_user_id = auth.uid())
    );


-- ----------- 4. service_role 不需要 policy，自动绕过 RLS -----------
-- 但要记住：服务端代码（Edge Functions / NCDM trainer / admin endpoint）
-- 必须用 SUPABASE_SERVICE_ROLE_KEY 而不是 anon key，否则照样被 RLS 拦


-- ----------- 5. auth_user_id 字段已在 0001 students 表里建好（uuid unique）+ 索引也有
-- 不再重复 ALTER 加 auth_uid 列（它原本是冗余的，统一用 0001 的 auth_user_id）


-- ----------- 6. PoC 期间宽松策略（30 学员内测，未上 Auth 时用） -----------
-- ⚠️ 这条策略允许 anon 读全部 students（仅在 5.5 - 6.1 内测期开启）
-- 6.1 后 Auth 接入完成必须 DROP 这条
CREATE POLICY "PoC 期间 anon 可读 students 用于 student_id 路由"
    ON students FOR SELECT
    TO anon
    USING (true);

-- 同期开放 student_states 可读（家长端 parent-radar 临时接）
CREATE POLICY "PoC 期间 anon 可读 student_states"
    ON student_states FOR SELECT
    TO anon
    USING (true);


-- ========================================================================
-- 验证：跑完此 migration 后，anon 应该能：
--   ✓ INSERT attempts / dialogues
--   ✓ SELECT questions / knowledge_points / textbook_sections / misconceptions
--   ✓ SELECT students / student_states（PoC 临时策略）
--   ✗ 不能 INSERT students（防止有人乱建账号）
--   ✗ 不能 SELECT textbook_files（避免 storage path 泄露）
--   ✗ 不能 UPDATE / DELETE 任何表
-- ========================================================================
