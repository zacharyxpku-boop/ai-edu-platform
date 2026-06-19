-- 商用级数据库整改：给 anon 可读的敏感表开启行级安全（RLS）
-- 背景：审计实测 anon key 能直读 students(name/birthday/goals)、student_states、questions
-- 影响：开启 RLS 后默认拒绝 anon/authenticated 的一切访问；service_role 始终绕过 RLS
--      后端 26 个 api/*.js 全走 service_role → 不受影响。前端零密钥 → 不受影响。
-- 执行：Supabase 控制台 → SQL Editor → 粘贴运行；或 supabase db push
-- 执行后回归：小程序题库拉取（走 storage，不涉这些表）与后端读写应全部正常。

-- 1) 学生档案：含儿童 PII，彻底锁死，仅 service_role 可访问
alter table public.students enable row level security;

-- 2) 掌握度状态：连 student_id，同等锁死
alter table public.student_states enable row level security;

-- 3) 题库内容表：开启 RLS（默认锁死）。
--    若将来确有客户端需用 anon key 只读题库，取消下面一行注释放行 select：
alter table public.questions enable row level security;
-- create policy "anon_read_questions" on public.questions for select to anon using (true);

-- 验证（执行后应只剩 service_role 能读 students/student_states）：
--   set role anon; select count(*) from students;  -- 期望: permission denied / 0 行
--   reset role;
