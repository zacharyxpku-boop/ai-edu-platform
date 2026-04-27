-- ============================================================================
-- Fix: anon INSERT attempts / dialogues 被 RLS 拒
-- 触发场景：smoke-test-supabase.sh 里 d/e 两项 FAIL · HTTP 401 · code 42501
-- ============================================================================
-- 根因：
--   migrations-all-in-one.sql 第 607-631 行写了 INSERT policies for anon，
--   但实际 DB 里没有这两条 policy（只 ENABLE 了 RLS）。
--   现象：anon 调 POST /attempts、/dialogues 一律 42501。
--
-- 跑法：
--   1. 打开 Supabase Console → SQL Editor
--   2. 粘贴本文件全部内容 → Run
--   3. 在终端重跑 bash scripts/smoke-test-supabase.sh，应 10/10 PASS
-- ============================================================================

-- 防御式重建（如果之前有同名 policy 先 drop）
DROP POLICY IF EXISTS "学生写题日志（anon allow insert）" ON attempts;
DROP POLICY IF EXISTS "anon_insert_attempts"            ON attempts;

CREATE POLICY "anon_insert_attempts"
    ON attempts FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "对话日志可写"      ON dialogues;
DROP POLICY IF EXISTS "anon_insert_dialogues" ON dialogues;

CREATE POLICY "anon_insert_dialogues"
    ON dialogues FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- 验证（应返回 2 行）
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('attempts', 'dialogues')
  AND cmd = 'INSERT';
