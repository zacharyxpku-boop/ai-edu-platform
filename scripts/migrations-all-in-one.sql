-- ========================================================================
-- 原点 AI 私教 · 一键 Migration（0001 → 0006 合并版）
-- ========================================================================
-- 用法：
--   1. supabase Dashboard → SQL Editor → New Query
--   2. 整个文件 paste 进去
--   3. Run（约 5-10 秒）
--
-- 前置：moriwork 项目已确认无业务数据需保留
-- 跑完后：12 表 + 7 enum + 2 个 pgvector 维度（1024+1536）+ 7 个 PG function + RLS
-- ========================================================================

-- 必备扩展（0001/0002 依赖）
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists vector;

-- 注意：如果 moriwork 旧表跟下面的同名（students/questions/dialogues 等），跑会报错
-- 旧表清空请单独跑（一行）：
-- DROP TABLE IF EXISTS students, questions, attempts, dialogues, knowledge_points,
--                       student_states, misconceptions, textbook_sections,
--                       textbook_files, textbook_chunks CASCADE;


-- ====================================================================
-- Migration: 0001_init.sql
-- ====================================================================
-- =============================================================================
-- 原点 AI 私教 · 初始 Schema · v0.1
-- =============================================================================
-- 设计原则：
--   1. 数据源可换 —— 所有外部数据用 (source, source_id) 复合唯一键标识
--   2. 知识点为锚 —— knowledge_points 是核心枢纽，questions/textbook_sections
--      /student_states 都通过 knowledge_point_ids[] 反查
--   3. 软删除审计 —— 全表统一 created_at / updated_at，可加 deleted_at
--   4. 协议风险隔离 —— GPLv3 来源数据（ChinaTextbook）只存 metadata + URL，
--      原始内容不入库
-- =============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- 模糊搜索（题目去重）

-- =============================================================================
-- 枚举类型
-- =============================================================================
create type subject_enum as enum (
  'chinese', 'math', 'english', 'physics', 'chemistry', 'biology',
  'history', 'geography', 'politics', 'science', 'ethics', 'other'
);

create type grade_enum as enum (
  'primary_1','primary_2','primary_3','primary_4','primary_5','primary_6',
  'middle_1','middle_2','middle_3',
  'high_1','high_2','high_3'
);

create type stage_enum as enum ('primary', 'middle', 'high');

create type question_type_enum as enum (
  'mcq_single',      -- 单选
  'mcq_multi',       -- 多选
  'fill_blank',      -- 填空
  'short_answer',    -- 简答
  'open_ended',      -- 开放题
  'cloze',           -- 完形
  'reading_comp',    -- 阅读理解
  'translation',     -- 翻译
  'essay'            -- 作文
);

create type question_source_enum as enum (
  'gaokao_bench',    -- OpenLMLab/GAOKAO-Bench (Apache 2.0)
  'e_eval',          -- AI-EDU-LAB/E-EVAL (MIT)
  'self_authored',   -- 自研题
  'user_uploaded',   -- 用户上传
  'other'
);

create type hint_level_enum as enum ('none', 'light', 'medium', 'strong', 'reveal');

create type misconception_category_enum as enum (
  'concept',         -- 概念错误
  'calculation',     -- 计算错误
  'reading',         -- 审题错误
  'procedure',       -- 步骤错误
  'language',        -- 语言/翻译错误
  'careless',        -- 粗心
  'unknown'
);

create type dialogue_role_enum as enum ('student', 'tutor', 'system', 'tool');

-- =============================================================================
-- 1. knowledge_points · 知识点图谱（CK12 + EDUKG 合并）
-- =============================================================================
-- 来源：tal-tech/chinese-k12-evaluation 584 一级 + 1989 二级
--      THU-KEG/EDUKG 高校知识图谱（补充先修关系）
create table knowledge_points (
  id                   uuid primary key default gen_random_uuid(),
  parent_id            uuid references knowledge_points(id) on delete set null,
  level                int  not null check (level between 1 and 5),  -- 1=一级 2=二级 ...
  subject              subject_enum not null,
  grade                grade_enum,                          -- 可空：跨年级知识点
  stage                stage_enum not null,                 -- 学段（primary/middle/high）
  curriculum_version   text,                                -- 课标版本（如 "2022人教版"）
  name                 text not null,
  description          text,
  prerequisites_ids    uuid[] default '{}',                 -- 先修知识点 ID
  source               text not null default 'ck12',        -- ck12 | edukg | merged
  source_id            text,                                -- 原始来源 ID
  external_refs        jsonb default '{}'::jsonb,           -- 外部引用：{"edukg":"...","wikidata":"..."}
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (source, source_id)
);

create index idx_kp_subject_stage on knowledge_points(subject, stage);
create index idx_kp_parent on knowledge_points(parent_id);
create index idx_kp_name_trgm on knowledge_points using gin (name gin_trgm_ops);

-- =============================================================================
-- 2. questions · 题库（GAOKAO-Bench / E-EVAL / 自研）
-- =============================================================================
create table questions (
  id                   uuid primary key default gen_random_uuid(),
  source               question_source_enum not null,
  source_id            text not null,                       -- 原数据集 ID
  source_meta          jsonb default '{}'::jsonb,           -- {year, paper_type, region, ...}
  subject              subject_enum not null,
  grade                grade_enum,
  stage                stage_enum not null,
  type                 question_type_enum not null,
  content              text not null,                       -- 题面（含选项）
  options              jsonb,                               -- {"A":"...", "B":"...", ...}
  answer               text not null,                       -- 标准答案（多选用 JSON 数组字符串）
  explanation          text,                                -- 解析
  difficulty           numeric(3,2) check (difficulty between 0 and 1),  -- 0=最易 1=最难
  knowledge_point_ids  uuid[] default '{}',                 -- 标签的知识点
  score               int,                                  -- 原题分值
  language             text default 'zh',
  is_active            boolean not null default true,       -- 软下架
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (source, source_id)
);

create index idx_q_source on questions(source);
create index idx_q_subject_stage on questions(subject, stage);
create index idx_q_kp on questions using gin (knowledge_point_ids);
create index idx_q_active on questions(is_active) where is_active = true;
create index idx_q_content_trgm on questions using gin (content gin_trgm_ops);  -- 去重

-- =============================================================================
-- 3. textbook_sections · 教材章节锚点（ChinaTextbook）
-- =============================================================================
-- ⚠️ 协议：ChinaTextbook 是 GPLv3
-- 我们只存 metadata + content_url（指向 GitHub raw CDN），不存 PDF 内容本体
create table textbook_sections (
  id                   uuid primary key default gen_random_uuid(),
  textbook             text not null,                       -- "人教版-初中数学"
  publisher            text,                                -- "人民教育出版社"
  edition              text,                                -- "2013版"
  grade                grade_enum not null,
  subject              subject_enum not null,
  stage                stage_enum not null,
  chapter_path         text[] not null,                     -- ["第一章","1.1 节","1.1.2 小节"]
  page_start           int,
  page_end             int,
  content_url          text not null,                       -- raw.githubusercontent.com 直链
  content_hash         text,                                -- PDF SHA256，验证未被替换
  knowledge_point_ids  uuid[] default '{}',
  source               text not null default 'chinatextbook',
  source_meta          jsonb default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (source, textbook, chapter_path)        -- 直接用数组本身做 unique（PG 支持）
);

create index idx_ts_grade_subject on textbook_sections(grade, subject);
create index idx_ts_kp on textbook_sections using gin (knowledge_point_ids);

-- =============================================================================
-- 4. students · 学生档案
-- =============================================================================
create table students (
  id                   uuid primary key default gen_random_uuid(),
  auth_user_id         uuid unique,                         -- Supabase auth.users.id
  name                 text not null,
  grade                grade_enum not null,
  stage                stage_enum not null,
  subjects             subject_enum[] default '{}',         -- 在学科目
  birthday             date,
  goals                jsonb default '{}'::jsonb,           -- {"target_score":120,"exam":"中考"}
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

create index idx_students_auth on students(auth_user_id);
create index idx_students_grade on students(grade) where deleted_at is null;

-- =============================================================================
-- 5. student_states · 学生认知诊断状态（EduCDM 输出落地）
-- =============================================================================
create table student_states (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid not null references students(id) on delete cascade,
  knowledge_point_id   uuid not null references knowledge_points(id) on delete cascade,
  mastery_score        numeric(4,3) not null check (mastery_score between 0 and 1),
  -- 来源模型：dina | irt | ncd | gpt-eval
  model_name           text not null default 'ncd',
  model_version        text,
  confidence           numeric(4,3),                        -- 模型置信度
  attempts_count       int not null default 0,
  correct_count        int not null default 0,
  last_practiced_at    timestamptz,
  next_review_at       timestamptz,                         -- FSRS 下次复习时间
  fsrs_state           jsonb default '{}'::jsonb,           -- {stability, difficulty, retrievability}
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (student_id, knowledge_point_id)
);

create index idx_ss_student on student_states(student_id);
create index idx_ss_kp on student_states(knowledge_point_id);
create index idx_ss_next_review on student_states(next_review_at) where next_review_at is not null;
create index idx_ss_low_mastery on student_states(student_id, mastery_score) where mastery_score < 0.6;

-- =============================================================================
-- 6. attempts · 答题记录
-- =============================================================================
create table attempts (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid not null references students(id) on delete cascade,
  question_id          uuid not null references questions(id) on delete restrict,
  session_id           uuid,                                -- 同一次练习的多题
  submitted_at         timestamptz not null default now(),
  response             text not null,                       -- 学生答案
  is_correct           boolean,
  partial_score        numeric(4,3),                        -- 主观题部分对
  time_spent_ms        int,
  hint_level           hint_level_enum not null default 'none',
  hints_used           int not null default 0,
  misconception_id     uuid,                                -- FK 在 misconceptions 表建好后由下方 alter add constraint 挂上
  scored_by            text,                                -- "rule" | "gpt-4" | "human"
  scored_meta          jsonb default '{}'::jsonb,
  knowledge_point_ids  uuid[] default '{}',                 -- 冗余：方便不联表查询
  created_at           timestamptz not null default now()
);

create index idx_attempts_student_time on attempts(student_id, submitted_at desc);
create index idx_attempts_question on attempts(question_id);
create index idx_attempts_session on attempts(session_id);
create index idx_attempts_kp on attempts using gin (knowledge_point_ids);

-- =============================================================================
-- 7. misconceptions · 错误模式库
-- =============================================================================
create table misconceptions (
  id                   uuid primary key default gen_random_uuid(),
  category             misconception_category_enum not null,
  subject              subject_enum,
  knowledge_point_ids  uuid[] default '{}',
  name                 text not null,                       -- "把 (a+b)^2 展开成 a^2+b^2"
  description          text,
  examples             jsonb default '[]'::jsonb,           -- [{q_id, wrong_response, correct}]
  remediation_strategy text,                                -- 纠正建议
  occurrence_count     int not null default 0,              -- 全平台出现次数
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_misc_category on misconceptions(category);
create index idx_misc_kp on misconceptions using gin (knowledge_point_ids);

-- 把 attempts.misconception_id 的外键补上（misconceptions 在它之后建表）
alter table attempts
  add constraint fk_attempts_misconception
  foreign key (misconception_id) references misconceptions(id) on delete set null;

-- =============================================================================
-- 8. dialogues · 对话日志（未来训练数据）
-- =============================================================================
create table dialogues (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid not null references students(id) on delete cascade,
  session_id           uuid not null,
  question_id          uuid references questions(id) on delete set null,
  attempt_id           uuid references attempts(id) on delete set null,
  turn_index           int not null,
  role                 dialogue_role_enum not null,
  content              text not null,
  tool_calls           jsonb,                               -- LLM tool calls
  tokens_in            int,
  tokens_out           int,
  model_name           text,
  latency_ms           int,
  created_at           timestamptz not null default now()
);

create index idx_dialogues_student on dialogues(student_id, created_at desc);
create index idx_dialogues_session on dialogues(session_id, turn_index);
create index idx_dialogues_question on dialogues(question_id) where question_id is not null;

-- =============================================================================
-- 触发器：自动维护 updated_at
-- =============================================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  for t in select unnest(array[
    'knowledge_points','questions','textbook_sections',
    'students','student_states','misconceptions'
  ]) loop
    execute format('create trigger trg_%s_updated before update on %s
                    for each row execute function set_updated_at()', t, t);
  end loop;
end$$;

-- =============================================================================
-- RLS 策略骨架（Supabase）—— 先开 RLS 占位，具体策略 v0.2 加
-- =============================================================================
alter table students         enable row level security;
alter table student_states   enable row level security;
alter table attempts         enable row level security;
alter table dialogues        enable row level security;

-- 公共数据（题库/知识点/教材）保持 public read，不开 RLS

-- =============================================================================
-- 视图：常用查询
-- =============================================================================
create or replace view v_student_weak_kps as
select
  s.id          as student_id,
  s.name        as student_name,
  s.grade,
  kp.id         as knowledge_point_id,
  kp.name       as kp_name,
  kp.subject,
  ss.mastery_score,
  ss.attempts_count,
  ss.last_practiced_at,
  ss.next_review_at
from student_states ss
  join students s          on s.id = ss.student_id
  join knowledge_points kp on kp.id = ss.knowledge_point_id
where ss.mastery_score < 0.6
  and s.deleted_at is null
order by ss.mastery_score asc;

comment on view v_student_weak_kps is '学生掌握度 < 0.6 的薄弱知识点，按掌握度升序';

-- =============================================================================
-- END
-- =============================================================================

-- ====================================================================
-- Migration: 0002_textbook_files_and_storage.sql
-- ====================================================================
-- ========================================================================
-- Migration 0002 · textbook_files + Storage 集成
-- ========================================================================
-- 方案 A+：PDF 下载到 Supabase Storage 私有 bucket，前端永不展示原文，
--          内部走 OCR + chunk + embedding → AI 私教 RAG 源。
--
-- 风险护栏：
--   1. textbook_files.deleted_at 字段——一键熔断，律师函 5 分钟内全下架
--   2. storage_bucket 默认 private，只有 service_role 能读写
--   3. 前端永远不直接拿 storage URL，必须走 server-side signed URL（短期失效）
-- ========================================================================

-- ----------- 1. textbook_files: PDF 文件元数据 + 存储指针 -----------
CREATE TABLE IF NOT EXISTS textbook_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 来源信息
    source_repo     TEXT NOT NULL DEFAULT 'ChinaTextbook',     -- 'ChinaTextbook' / 'gov-portal' / 'self-uploaded'
    source_url      TEXT NOT NULL,                             -- 原始 raw URL（GitHub 直链或政府平台）
    sha256          TEXT NOT NULL UNIQUE,                      -- 文件指纹，去重 + 完整性校验

    -- 教材属性
    publisher       TEXT NOT NULL,                             -- 人教 / 北师大 / 苏科 / 外研社…
    stage           TEXT NOT NULL CHECK (stage IN ('primary', 'middle', 'high', 'university')),
    subject         TEXT NOT NULL,                             -- math / physics / chemistry / biology / chinese / english / history / geography / politics
    grade           SMALLINT NOT NULL CHECK (grade BETWEEN 1 AND 12),
    volume          TEXT,                                      -- 上册 / 下册 / 全一册 / NULL
    edition_year    SMALLINT,                                  -- 教材版次年份

    -- 存储指针（Supabase Storage 私有 bucket）
    storage_bucket  TEXT NOT NULL DEFAULT 'textbooks',
    storage_path    TEXT NOT NULL,                             -- bucket 内的相对路径 e.g. 'middle/math/g7/renmin_v2024_vol1.pdf'
    file_size_bytes BIGINT,
    page_count      INT,

    -- 提取衍生品状态
    toc_extracted_at        TIMESTAMPTZ,                       -- TOC 章节树是否已抽
    text_extracted_at       TIMESTAMPTZ,                       -- 全文 OCR/text 是否已抽
    embedded_at             TIMESTAMPTZ,                       -- 向量库是否已建索引
    chunks_count            INT,                               -- 切块数量

    -- 合规护栏
    license_status  TEXT DEFAULT 'gray-zone',                  -- 'authorized' / 'gray-zone' / 'takedown'
    license_notes   TEXT,                                      -- 合规备注
    deleted_at      TIMESTAMPTZ,                               -- 一键熔断字段（NULL = 在用，非 NULL = 已下架）

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_textbook_files_subject_grade
    ON textbook_files (subject, stage, grade) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_textbook_files_publisher
    ON textbook_files (publisher) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_textbook_files_extraction_status
    ON textbook_files (toc_extracted_at, text_extracted_at, embedded_at);


-- ----------- 2. textbook_sections 升级：关联到 file_id + 加 RAG 字段 -----------
-- （0001_init 已建 textbook_sections，这里 ALTER 增字段）

ALTER TABLE textbook_sections
    ADD COLUMN IF NOT EXISTS file_id          UUID REFERENCES textbook_files(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS chapter_level    SMALLINT,                          -- 1=章 / 2=节 / 3=小节
    ADD COLUMN IF NOT EXISTS chunk_text       TEXT,                              -- OCR 后的章节正文（用于 RAG 检索）
    ADD COLUMN IF NOT EXISTS chunk_tokens     INT;                               -- 该 chunk 的 token 数

-- 注意：embedding 列单独放在 textbook_chunks 表，因为 1 章可能切 N 个 chunk


-- ----------- 3. textbook_chunks: RAG 向量库 -----------
-- 需要先在 Supabase 项目启用 pgvector 扩展：
--   CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS textbook_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id         UUID NOT NULL REFERENCES textbook_files(id) ON DELETE CASCADE,
    section_id      UUID REFERENCES textbook_sections(id) ON DELETE SET NULL,

    chunk_index     INT NOT NULL,                              -- 该文件内第几块
    page_start      INT,
    page_end        INT,
    content         TEXT NOT NULL,                             -- chunk 文本（500-1000 token）
    token_count     INT,

    -- pgvector 扩展，1536 维 = OpenAI text-embedding-3-small 维度
    embedding       VECTOR(1536),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (file_id, chunk_index)
);

-- 向量近邻检索索引（HNSW 比 IVFFlat 快，Supabase 已支持）
CREATE INDEX IF NOT EXISTS idx_textbook_chunks_embedding
    ON textbook_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_textbook_chunks_file
    ON textbook_chunks (file_id, chunk_index);


-- ----------- 4. 一键熔断 helper function -----------
-- 用法：SELECT takedown_textbooks(NULL, NULL);  -- 全下架
--       SELECT takedown_textbooks('人教', NULL);  -- 只下架人教
--       SELECT takedown_textbooks(NULL, 'math');  -- 只下架数学
CREATE OR REPLACE FUNCTION takedown_textbooks(
    p_publisher TEXT DEFAULT NULL,
    p_subject   TEXT DEFAULT NULL
) RETURNS INT AS $$
DECLARE
    affected_count INT;
BEGIN
    UPDATE textbook_files
    SET deleted_at = NOW(),
        license_status = 'takedown',
        updated_at = NOW()
    WHERE deleted_at IS NULL
      AND (p_publisher IS NULL OR publisher = p_publisher)
      AND (p_subject   IS NULL OR subject   = p_subject);

    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RAISE NOTICE 'Takedown: % file(s) marked deleted_at=NOW()', affected_count;
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql;


-- ----------- 5. RAG 检索 helper function -----------
-- 给定 query embedding + subject/grade 过滤，返回 top-K chunks
CREATE OR REPLACE FUNCTION search_textbook_chunks(
    query_embedding VECTOR(1536),
    p_subject       TEXT DEFAULT NULL,
    p_stage         TEXT DEFAULT NULL,
    p_grade         SMALLINT DEFAULT NULL,
    top_k           INT DEFAULT 5
) RETURNS TABLE (
    chunk_id        UUID,
    file_id         UUID,
    publisher       TEXT,
    subject         TEXT,
    grade           SMALLINT,
    page_start      INT,
    content         TEXT,
    similarity      FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.file_id,
        f.publisher,
        f.subject,
        f.grade,
        c.page_start,
        c.content,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM textbook_chunks c
    INNER JOIN textbook_files f ON f.id = c.file_id
    WHERE f.deleted_at IS NULL
      AND (p_subject IS NULL OR f.subject = p_subject)
      AND (p_stage   IS NULL OR f.stage   = p_stage)
      AND (p_grade   IS NULL OR f.grade   = p_grade)
    ORDER BY c.embedding <=> query_embedding
    LIMIT top_k;
END;
$$ LANGUAGE plpgsql STABLE;

-- ====================================================================
-- Migration: 0003_rls_policies.sql
-- ====================================================================
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

-- ====================================================================
-- Migration: 0004_align_demo_endpoints.sql
-- ====================================================================
-- ========================================================================
-- Migration 0004 · 端点字段对齐补丁
-- ========================================================================
-- Self-review 发现 0001 schema 与后续 ship 的 API 端点字段不一致。
-- 这份 migration 加最少必要字段，保持 0001 数据建模哲学不变。
-- ========================================================================

-- ---------- 1. students 加 cohort 字段 ----------
-- admin/summary 端点按 cohort=camp-2 查询五一营第二期学员
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS cohort TEXT;

CREATE INDEX IF NOT EXISTS idx_students_cohort
    ON students (cohort) WHERE deleted_at IS NULL;

COMMENT ON COLUMN students.cohort IS '批次标识，五一营第二期=camp-2，公测=public-1，等';


-- ---------- 2. dialogues 加 meta jsonb + kind ----------
-- 0001 已有 tool_calls jsonb，但语义偏 LLM tool calls
-- 我们需要更通用的 meta（装 4 字段隐性信号 / diagnose 出参 / retrieve 检索结果）
ALTER TABLE dialogues
    ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS kind TEXT;

CREATE INDEX IF NOT EXISTS idx_dialogues_kind
    ON dialogues (kind) WHERE kind IS NOT NULL;

-- 4 字段隐性信号查询用（mastery 引擎和数据分析用）
-- 全表表达式索引：partial index 的 WHERE 在 jsonb 上违反 immutability，去掉 WHERE
CREATE INDEX IF NOT EXISTS idx_dialogues_signals_extracted
    ON dialogues ((meta->>'signals_extracted_at'));

COMMENT ON COLUMN dialogues.kind IS 'chat / diagnose_call / retrieve_call / hint_request / mastery_event';
COMMENT ON COLUMN dialogues.meta IS '通用 jsonb：装 signals 4 字段抽取结果 / diagnose 出参 / retrieve 命中等';


-- ---------- 3. dialogues.session_id 改可空 + 默认值 ----------
-- 0001 设的 NOT NULL，但 PoC 期前端 ad-hoc 写库时没传 session_id
-- 改为可空，默认生成新 UUID（每条独立会话）
ALTER TABLE dialogues
    ALTER COLUMN session_id DROP NOT NULL,
    ALTER COLUMN session_id SET DEFAULT gen_random_uuid();


-- ---------- 4. attempts.question_id 改可空 ----------
-- 0001 设的 NOT NULL + FK，PoC 期 mastery-loop 用硬编码题目（不在 questions 表）
-- 临时改为可空 + 弱化 FK，6.1 后真题入库后再恢复 NOT NULL
ALTER TABLE attempts
    ALTER COLUMN question_id DROP NOT NULL;


-- ---------- 5. attempts 加 question_snapshot jsonb ----------
-- 临时题（不在 questions 表）的题面快照，便于事后 review 学生答了什么
-- 真题入库后这字段 = NULL（用 question_id 指）
ALTER TABLE attempts
    ADD COLUMN IF NOT EXISTS question_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS topic_code TEXT;          -- cn-k12-knowledge-ontology 的 kp_id 字符串编码

CREATE INDEX IF NOT EXISTS idx_attempts_topic_code
    ON attempts (topic_code) WHERE topic_code IS NOT NULL;


-- ---------- 6. 给 attempts.scored_meta 加常用查询 GIN 索引 ----------
-- admin/summary 要拉 scored_meta->>'mastery_after' 做聚合
CREATE INDEX IF NOT EXISTS idx_attempts_scored_meta_gin
    ON attempts USING gin (scored_meta);


-- ---------- 7. demo 学员 seed（PoC 期间快速验证 RLS）----------
-- 在 W5 五一营结营前启用，把 30 个内测学员预先插入
-- 跑 0004 时如果还没到内测期，COMMENT 这块即可
-- INSERT INTO students (id, name, grade, stage, cohort, subjects)
-- VALUES (gen_random_uuid(), 'Demo 同学', 'middle_1', 'middle', 'camp-2', '{math}')
-- ON CONFLICT DO NOTHING;


-- ========================================================================
-- 验证：跑完后端点字段对齐正确
--   ingest-attempt:     mastery_before/after/diagnose_l3 → scored_meta jsonb
--                       临时题 → question_snapshot
--                       cn-k12 kp_id → topic_code
--   log-dialogue:       meta jsonb · kind · session_id 自动 gen
--   extract-signals:    meta->>'signals_extracted_at' IS NULL 查询能跑
--   admin/summary:      students.cohort='camp-2' · attempts.scored_meta 读 mastery_*
-- ========================================================================

-- ====================================================================
-- Migration: 0005_kp_code_and_fsrs_helpers.sql
-- ====================================================================
-- ========================================================================
-- Migration 0005 · knowledge_points 加字符串 code + FSRS 查询 helper
-- ========================================================================
-- knowledge_points 主键是 UUID，但 cn-k12-knowledge-ontology.json 用字符串
-- 编码（如 math.7.ch3.kp3）。前端拿到的是 code 不是 UUID，需要桥接。
-- ========================================================================

-- ----------- 1. knowledge_points 加 code -----------
ALTER TABLE knowledge_points
    ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_kp_code ON knowledge_points (code) WHERE code IS NOT NULL;

COMMENT ON COLUMN knowledge_points.code IS
    'cn-k12-knowledge-ontology.json 的 kp_id，如 math.7.ch3.kp3。前端通过 code 路由，端点内部 lookup UUID';


-- ----------- 2. helper: code → UUID 转换 -----------
CREATE OR REPLACE FUNCTION kp_uuid_from_code(p_code TEXT)
RETURNS UUID AS $$
    SELECT id FROM knowledge_points WHERE code = p_code LIMIT 1;
$$ LANGUAGE SQL STABLE;


-- ----------- 3. helper: 拉学生 fsrs due 列表（按 retrievability 排序） -----------
CREATE OR REPLACE FUNCTION fsrs_due_for_student(p_student_id UUID, p_limit INT DEFAULT 10)
RETURNS TABLE (
    knowledge_point_id UUID,
    kp_code TEXT,
    kp_name TEXT,
    mastery_score NUMERIC,
    fsrs_state JSONB,
    is_overdue BOOLEAN,
    retrievability NUMERIC,
    next_review_at TIMESTAMPTZ
) AS $$
    SELECT
        ss.knowledge_point_id,
        kp.code,
        kp.name,
        ss.mastery_score,
        ss.fsrs_state,
        (ss.next_review_at IS NULL OR ss.next_review_at <= NOW()) AS is_overdue,
        -- retrievability = 0.9^(days_since_review / stability)
        CASE
            WHEN ss.fsrs_state IS NULL OR ss.fsrs_state = '{}'::jsonb THEN 0.0
            WHEN (ss.fsrs_state->>'last_review_at') IS NULL THEN 0.0
            ELSE POWER(0.9,
                EXTRACT(EPOCH FROM (NOW() - to_timestamp((ss.fsrs_state->>'last_review_at')::bigint / 1000.0))) / 86400.0
                / GREATEST(0.1, (ss.fsrs_state->>'stability')::numeric)
            )
        END AS retrievability,
        ss.next_review_at
    FROM student_states ss
    LEFT JOIN knowledge_points kp ON kp.id = ss.knowledge_point_id
    WHERE ss.student_id = p_student_id
      AND (ss.next_review_at IS NULL OR ss.next_review_at <= NOW() + INTERVAL '12 hours')
    ORDER BY retrievability ASC, ss.next_review_at NULLS FIRST
    LIMIT p_limit;
$$ LANGUAGE SQL STABLE;


-- ----------- 4. helper: 学生总览（Khanmigo 五件家长端的数据底座） -----------
CREATE OR REPLACE FUNCTION student_overview(p_student_id UUID)
RETURNS TABLE (
    total_kps INT,
    mastered_kps INT,
    learning_kps INT,
    weak_kps INT,
    due_today_count INT,
    avg_mastery NUMERIC,
    last_active_at TIMESTAMPTZ
) AS $$
    SELECT
        COUNT(*)::INT AS total_kps,
        COUNT(*) FILTER (WHERE mastery_score >= 0.85)::INT AS mastered_kps,
        COUNT(*) FILTER (WHERE mastery_score BETWEEN 0.4 AND 0.85)::INT AS learning_kps,
        COUNT(*) FILTER (WHERE mastery_score < 0.4)::INT AS weak_kps,
        COUNT(*) FILTER (WHERE next_review_at <= NOW() + INTERVAL '12 hours')::INT AS due_today_count,
        ROUND(AVG(mastery_score)::numeric, 3) AS avg_mastery,
        MAX(last_practiced_at) AS last_active_at
    FROM student_states
    WHERE student_id = p_student_id;
$$ LANGUAGE SQL STABLE;

-- ====================================================================
-- Migration: 0006_dialogue_embeddings.sql
-- ====================================================================
-- ========================================================================
-- Migration 0006 · dialogues 加 embedding（跨会话长期记忆基础）
-- ========================================================================
-- 不引 mem0 包，直接用现有 dialogues 表 + pgvector。
-- 用阿里 dashscope text-embedding-v3（1024 维），QWEN_KEY 已配。
--
-- 数据流：
--   1. mastery-loop 答题/对话 → log-dialogue 写入 dialogues
--   2. 04:00 cron 调 /api/embed-dialogue 批量给未 embedded 的对话算向量
--   3. 学生开新题时 → /api/student-memory?query=... → 拉过去最相似的 N 条对话
--   4. tutor 把这些对话拼进 system prompt，做「真私教记得你」
-- ========================================================================

-- pgvector 0002 已经 CREATE EXTENSION 过，这里直接用

ALTER TABLE dialogues
    ADD COLUMN IF NOT EXISTS embedding VECTOR(1024);   -- dashscope text-embedding-v3 = 1024

-- HNSW 索引（比 IVFFlat 稳，适合 < 100 万行）
CREATE INDEX IF NOT EXISTS idx_dialogues_embedding_hnsw
    ON dialogues USING hnsw (embedding vector_cosine_ops);

-- 部分索引：只对学生消息建（tutor / system 消息检索价值低）
CREATE INDEX IF NOT EXISTS idx_dialogues_student_role_for_memory
    ON dialogues (student_id, created_at DESC)
    WHERE role = 'student' AND embedding IS NOT NULL;


-- ----------- 检索 helper：拉某学生过去最相似的 N 条对话 -----------
-- 用法：SELECT * FROM student_memory_search('uuid-of-student', '<vec>', 5);
CREATE OR REPLACE FUNCTION student_memory_search(
    p_student_id UUID,
    p_query_embedding VECTOR(1024),
    p_top_k INT DEFAULT 5,
    p_min_age_seconds INT DEFAULT 1800     -- 30 分钟内的对话不召回（避免拉刚说的话当回忆）
) RETURNS TABLE (
    dialogue_id UUID,
    role TEXT,
    content TEXT,
    kind TEXT,
    similarity FLOAT,
    created_at TIMESTAMPTZ,
    signals JSONB
) AS $$
    SELECT
        d.id,
        d.role::text,
        d.content,
        d.kind,
        1 - (d.embedding <=> p_query_embedding) AS similarity,
        d.created_at,
        d.meta->'signals' AS signals
    FROM dialogues d
    WHERE d.student_id = p_student_id
      AND d.embedding IS NOT NULL
      AND d.created_at < NOW() - (p_min_age_seconds || ' seconds')::INTERVAL
    ORDER BY d.embedding <=> p_query_embedding
    LIMIT p_top_k;
$$ LANGUAGE SQL STABLE;


-- ----------- 学生「记忆指纹」（用于摘要展示给 tutor）-----------
-- 把该学生最近 30 天 dialogues.meta.signals 聚合，统计高频卡点 / 主导情绪等
CREATE OR REPLACE FUNCTION student_signal_profile(p_student_id UUID)
RETURNS TABLE (
    top_stuck_points TEXT[],
    top_misconceptions TEXT[],
    dominant_emotion TEXT,
    analogy_success_rate NUMERIC,
    total_dialogues INT,
    total_with_signals INT
) AS $$
    WITH recent AS (
        SELECT meta->'signals' AS s, meta->>'signals_extracted_at' AS ext_at
        FROM dialogues
        WHERE student_id = p_student_id
          AND created_at > NOW() - INTERVAL '30 days'
          AND meta ? 'signals'
    ),
    stuck AS (
        SELECT s->>'stuck_point' AS sp, COUNT(*) AS c
        FROM recent
        WHERE s->>'stuck_point' IS NOT NULL AND s->>'stuck_point' != 'null'
        GROUP BY 1 ORDER BY c DESC LIMIT 5
    ),
    misc AS (
        SELECT s->>'misconception_l3' AS m, COUNT(*) AS c
        FROM recent
        WHERE s->>'misconception_l3' IS NOT NULL AND s->>'misconception_l3' != 'null'
        GROUP BY 1 ORDER BY c DESC LIMIT 5
    ),
    emo AS (
        SELECT s->>'emotion_state' AS e, COUNT(*) AS c
        FROM recent
        WHERE s->>'emotion_state' IS NOT NULL
        GROUP BY 1 ORDER BY c DESC LIMIT 1
    ),
    analogy AS (
        SELECT
            COUNT(*) FILTER (WHERE (s->>'analogy_effective')::boolean = true) AS hits,
            COUNT(*) FILTER (WHERE (s->>'analogy_effective')::boolean IS NOT NULL) AS total
        FROM recent
    )
    SELECT
        ARRAY(SELECT sp FROM stuck),
        ARRAY(SELECT m FROM misc),
        (SELECT e FROM emo),
        CASE WHEN (SELECT total FROM analogy) > 0
             THEN ROUND((SELECT hits FROM analogy)::numeric / (SELECT total FROM analogy)::numeric, 3)
             ELSE NULL END,
        (SELECT COUNT(*)::INT FROM dialogues WHERE student_id = p_student_id AND created_at > NOW() - INTERVAL '30 days'),
        (SELECT COUNT(*)::INT FROM recent);
$$ LANGUAGE SQL STABLE;
