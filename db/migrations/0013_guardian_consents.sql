-- =============================================================================
-- 0013 · 监护人同意核身（PIPL §31 + 未成年人网络保护条例 §31）
-- =============================================================================
-- 法律基础：
--   《个人信息保护法》第 31 条 · 处理不满十四周岁未成年人个人信息的，
--                              应当取得未成年人的父母或者其他监护人的同意。
--   《未成年人网络保护条例》第 31 条 · 取得监护人同意应可被验证。
--
-- 设计：
--   1. 学生提交「我已获得监护人同意」时，必须先经过验证码闭环
--   2. 学生填家长邮箱（或手机号）→ 系统下发 6 位 code
--   3. 家长把 code 念给孩子（或孩子直接看邮件）回填 → 写 verified=true
--   4. /api/student-init 接受 consent_token，绑回该 student_id
--   5. 30 天 code 失效；同 contact 24h 限 3 次发码（防短信轰炸）
-- =============================================================================

CREATE TABLE IF NOT EXISTS guardian_consents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 注册前 student_id 还未生成，先空；verified 后由 student-init 端点回填
  student_id          uuid REFERENCES students(id) ON DELETE CASCADE,
  -- 学生填的孩子昵称，便于家长在邮件里识别 "X 同学申请使用原小点"
  student_name_hint   text NOT NULL,
  guardian_contact    text NOT NULL,            -- email 或 phone（统一存）
  contact_kind        text NOT NULL CHECK (contact_kind IN ('email', 'phone')),
  -- 6 位数字 code，仅 send 阶段写入；verify 后清空
  code_hash           text,                     -- sha256(code) 不存明文
  code_sent_at        timestamptz,
  code_attempts       smallint NOT NULL DEFAULT 0,
  -- consent_token 由 verify 阶段生成，welcome.html 回填给 student-init
  consent_token       text UNIQUE,
  verified            boolean NOT NULL DEFAULT false,
  verified_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  user_agent          text,
  meta                jsonb DEFAULT '{}'::jsonb
);

-- 同 contact 24h 限 3 次发码（防短信/邮件轰炸）
CREATE INDEX IF NOT EXISTS idx_guardian_contact_recent
  ON guardian_consents(guardian_contact, code_sent_at DESC)
  WHERE code_sent_at IS NOT NULL;

-- consent_token 用于 student-init 闭环回填
CREATE INDEX IF NOT EXISTS idx_guardian_consent_token
  ON guardian_consents(consent_token)
  WHERE verified = true AND consent_token IS NOT NULL;

-- 学生删账户走 student_id 索引
CREATE INDEX IF NOT EXISTS idx_guardian_student
  ON guardian_consents(student_id)
  WHERE student_id IS NOT NULL;

ALTER TABLE guardian_consents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "service_role_full" ON guardian_consents
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TABLE guardian_consents IS
  'PIPL §31 监护人同意可验证记录 · 6 位 code 邮件/短信下发 · 30 天有效期';
COMMENT ON COLUMN guardian_consents.code_hash IS
  'sha256(code) · 不存明文 · verify 通过后置空';
COMMENT ON COLUMN guardian_consents.consent_token IS
  '验证通过的凭证 · welcome.html 提交注册时一起带 · student-init 用它绑 student_id';

-- =============================================================================
-- 函数：guardian_consent_create_pending
--   send 阶段调用 · 写一行 pending 记录返回 id 给前端
-- =============================================================================
CREATE OR REPLACE FUNCTION guardian_consent_create_pending(
  p_student_name text,
  p_contact      text,
  p_contact_kind text,
  p_code_hash    text,
  p_user_agent   text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_recent_count int;
  v_id uuid;
BEGIN
  -- 同 contact 24h 内已发码 ≥3 次 → 拒
  SELECT COUNT(*) INTO v_recent_count
    FROM guardian_consents
   WHERE guardian_contact = p_contact
     AND code_sent_at > now() - interval '24 hours';

  IF v_recent_count >= 3 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO guardian_consents
    (student_name_hint, guardian_contact, contact_kind, code_hash, code_sent_at, user_agent)
  VALUES
    (left(p_student_name, 50), p_contact, p_contact_kind, p_code_hash, now(), left(p_user_agent, 200))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION guardian_consent_create_pending(text, text, text, text, text) IS
  'send 阶段写 pending 记录 · 24h 同 contact 限 3 次 · 抛 rate_limited';

-- =============================================================================
-- 函数：guardian_consent_verify
--   verify 阶段调用 · 比对 hash · 通过则发 consent_token
-- =============================================================================
CREATE OR REPLACE FUNCTION guardian_consent_verify(
  p_id        uuid,
  p_code_hash text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_row guardian_consents%ROWTYPE;
  v_token text;
BEGIN
  SELECT * INTO v_row FROM guardian_consents WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_row.verified THEN
    RETURN jsonb_build_object('ok', true, 'consent_token', v_row.consent_token, 'note', '已验证');
  END IF;

  -- 5 次尝试上限
  IF v_row.code_attempts >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  END IF;

  IF v_row.code_sent_at IS NULL OR v_row.code_sent_at < now() - interval '30 minutes' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_expired', 'note', 'code 30 分钟后过期');
  END IF;

  IF v_row.code_hash IS NULL OR v_row.code_hash <> p_code_hash THEN
    UPDATE guardian_consents SET code_attempts = code_attempts + 1 WHERE id = p_id;
    RETURN jsonb_build_object('ok', false, 'error', 'code_mismatch');
  END IF;

  -- 通过 · 生成 token（uuid 去横线）
  v_token := replace(gen_random_uuid()::text, '-', '');
  UPDATE guardian_consents
     SET verified = true,
         verified_at = now(),
         consent_token = v_token,
         code_hash = NULL  -- 清明文 hash
   WHERE id = p_id;

  RETURN jsonb_build_object(
    'ok', true,
    'consent_token', v_token,
    'verified_at', now()
  );
END;
$$;

COMMENT ON FUNCTION guardian_consent_verify(uuid, text) IS
  'verify 阶段比对 sha256 · 5 次尝试上限 · 30 分钟过期 · 通过发 consent_token';

-- =============================================================================
-- 函数：guardian_consent_bind_student
--   student-init 创建学生后调用 · 把 consent_token 绑回 student_id
-- =============================================================================
CREATE OR REPLACE FUNCTION guardian_consent_bind_student(
  p_token      text,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_token');
  END IF;

  SELECT id INTO v_id
    FROM guardian_consents
   WHERE consent_token = p_token
     AND verified = true
     AND student_id IS NULL
     AND expires_at > now()
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_invalid_or_used');
  END IF;

  UPDATE guardian_consents
     SET student_id = p_student_id
   WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'consent_id', v_id, 'student_id', p_student_id);
END;
$$;

COMMENT ON FUNCTION guardian_consent_bind_student(text, uuid) IS
  'student-init 阶段把 verified consent 绑到 student · 一次性 · token 用完即弃';

DO $$ BEGIN RAISE NOTICE '[7/7] 0013 guardian_consents 表 + 3 个 RPC 函数 ✓'; END $$;
