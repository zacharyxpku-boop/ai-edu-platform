-- 生产 RLS 收口：移除 PoC 期间匿名读学生数据/题库数据的策略。
-- 前端不直接连接 Supabase；所有读写经 Vercel API，服务端使用 service_role。

alter table public.students enable row level security;
alter table public.student_states enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.dialogues enable row level security;

drop policy if exists "PoC 期间 anon 可读 students 用于 student_id 路由" on public.students;
drop policy if exists "PoC 期间 anon 可读 student_states" on public.student_states;
drop policy if exists "公共题目所有人可读" on public.questions;
drop policy if exists "anon_read_questions" on public.questions;

drop policy if exists "学生写题日志（anon allow insert）" on public.attempts;
create policy "attempts_server_insert_only"
  on public.attempts
  for insert
  to anon
  with check (false);

drop policy if exists "对话日志可写" on public.dialogues;
create policy "dialogues_server_insert_only"
  on public.dialogues
  for insert
  to anon
  with check (false);

-- 验证预期：
-- set role anon;
-- select count(*) from students;        -- permission denied / 0 rows
-- select count(*) from student_states;  -- permission denied / 0 rows
-- select count(*) from questions;       -- permission denied / 0 rows
-- insert into attempts default values;  -- denied by policy / schema constraint
-- reset role;
