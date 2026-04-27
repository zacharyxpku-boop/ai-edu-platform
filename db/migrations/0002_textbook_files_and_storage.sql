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
