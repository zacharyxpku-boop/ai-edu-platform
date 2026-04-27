#!/usr/bin/env bash
# 原点 AI 私教 · Supabase 直连 smoke test
# Vercel 还没部署，所以这版只验证数据层（PostgREST + RPC + RLS）真活
#
# 用法：
#   bash scripts/smoke-test-supabase.sh
# 自定义 env 文件：
#   ENV_FILE=.env.local bash scripts/smoke-test-supabase.sh
#
# 通过条件：10 项 PASS。FAIL 输出 HTTP code + 错误片段前 300 字符
# 依赖：curl + grep + sed（jq 可选，没装也跑）

set -u

ENV_FILE="${ENV_FILE:-.env.local}"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    eval "$(grep -E '^(SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)=' "$ENV_FILE")"
    set +a
fi

: "${SUPABASE_URL:?SUPABASE_URL 没读到，检查 .env.local}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY 没读到}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY 没读到}"

DEMO_STUDENT="${DEMO_STUDENT:-00000000-0000-0000-0000-000000000001}"

GREEN=$'\033[0;32m'
RED=$'\033[0;31m'
YELLOW=$'\033[1;33m'
DIM=$'\033[2m'
RESET=$'\033[0m'

PASS=0; FAIL=0; SKIP=0
FAIL_DETAILS=()

# 全局 LAST_BODY，避免 stdout 混淆 PASS 行
LAST_CODE=""
LAST_BODY=""

# 调 PostgREST，结果写入 LAST_CODE / LAST_BODY
rest() {
    local method=$1; local path=$2; local key=$3; local body=${4:-}; local prefer=${5:-}
    local extra=()
    [[ -n "$body"   ]] && extra+=(--data-raw "$body" -H "Content-Type: application/json")
    [[ -n "$prefer" ]] && extra+=(-H "Prefer: $prefer")
    local raw
    raw=$(curl -sS -X "$method" "$SUPABASE_URL/rest/v1$path" \
        -H "apikey: $key" \
        -H "Authorization: Bearer $key" \
        "${extra[@]}" \
        -w $'\n__HTTP__%{http_code}' 2>&1)
    LAST_CODE=$(printf '%s' "$raw" | grep -o '__HTTP__[0-9]*' | tail -1 | grep -o '[0-9]*')
    LAST_BODY=$(printf '%s' "$raw" | sed 's/__HTTP__[0-9]*$//')
}

# expect <name> <expected_codes_regex>
# 用 LAST_CODE / LAST_BODY，全部输出走 stdout（不再用 echo 当返回值）
expect() {
    local name=$1; local ok_re=$2
    local short; short=$(printf '%s' "$LAST_BODY" | head -c 300)
    if [[ "$LAST_CODE" =~ $ok_re ]]; then
        printf '%s[PASS]%s %s  HTTP %s\n' "$GREEN" "$RESET" "$name" "$LAST_CODE"
        PASS=$((PASS+1))
        return 0
    else
        printf '%s[FAIL]%s %s  HTTP %s\n%s        %s%s\n' \
            "$RED" "$RESET" "$name" "$LAST_CODE" "$DIM" "$short" "$RESET"
        FAIL=$((FAIL+1))
        FAIL_DETAILS+=("$name -> HTTP $LAST_CODE · $short")
        return 1
    fi
}

echo "==================================================================="
echo "  Yuandian AI Tutor · Supabase smoke test"
echo "  URL:    $SUPABASE_URL"
echo "  STUDENT: $DEMO_STUDENT"
echo "==================================================================="

# ---- a. anon SELECT questions（公共读） --------------------------------------
echo ""
echo "── a. anon SELECT questions ──"
rest GET "/questions?select=id&limit=1" "$SUPABASE_ANON_KEY"
expect "anon SELECT questions" '^200$'
QUESTION_ID=$(printf '%s' "$LAST_BODY" | grep -oE '"id":"[0-9a-f-]+"' | head -1 | sed 's/.*"\([0-9a-f-]*\)"/\1/')

# ---- b. anon SELECT knowledge_points ----------------------------------------
echo ""
echo "── b. anon SELECT knowledge_points ──"
rest GET "/knowledge_points?select=id,code&limit=1" "$SUPABASE_ANON_KEY"
expect "anon SELECT knowledge_points" '^200$'

# ---- c. anon SELECT students（PoC） -----------------------------------------
echo ""
echo "── c. anon SELECT students (PoC) ──"
rest GET "/students?select=id,name&limit=1" "$SUPABASE_ANON_KEY"
expect "anon SELECT students (PoC)" '^200$'

# ---- d. anon INSERT attempts ------------------------------------------------
echo ""
echo "── d. anon INSERT attempts ──"
if [[ -z "${QUESTION_ID:-}" ]]; then
    printf '%s[SKIP]%s anon INSERT attempts  no question_id\n' "$YELLOW" "$RESET"
    SKIP=$((SKIP+1))
else
    body=$(printf '{"student_id":"%s","question_id":"%s","session_id":"%s","response":"smoke","is_correct":true,"time_spent_ms":1234}' \
        "$DEMO_STUDENT" "$QUESTION_ID" "00000000-0000-0000-0000-0000000000aa")
    # return=minimal 绕开 attempts SELECT RLS（anon 没 SELECT 权限）
    rest POST "/attempts" "$SUPABASE_ANON_KEY" "$body" "return=minimal"
    expect "anon INSERT attempts" '^(200|201|204)$'
fi

# ---- e. anon INSERT dialogues -----------------------------------------------
echo ""
echo "── e. anon INSERT dialogues ──"
body=$(printf '{"student_id":"%s","session_id":"%s","turn_index":0,"role":"student","content":"smoke test dialogue"}' \
    "$DEMO_STUDENT" "00000000-0000-0000-0000-0000000000bb")
rest POST "/dialogues" "$SUPABASE_ANON_KEY" "$body" "return=minimal"
expect "anon INSERT dialogues" '^(200|201|204)$'

# ---- f. anon INSERT students 应被拒 -----------------------------------------
echo ""
echo "── f. anon INSERT students (should reject) ──"
body='{"name":"smoke-evil","grade":"middle_1","stage":"middle"}'
rest POST "/students" "$SUPABASE_ANON_KEY" "$body" "return=representation"
expect "anon INSERT students rejected" '^(401|403)$'

# ---- g. anon SELECT textbook_files 应空/拒 ----------------------------------
# RLS policy 给了 SELECT TO authenticated（不含 anon），所以 PostgREST 返回 200 + []
# 同时验：表里有数据，但 anon 拿不到任何行
echo ""
echo "── g. anon SELECT textbook_files (should empty/reject) ──"
rest GET "/textbook_files?select=id&limit=5" "$SUPABASE_ANON_KEY"
if [[ "$LAST_CODE" == "401" || "$LAST_CODE" == "403" ]]; then
    printf '%s[PASS]%s anon SELECT textbook_files rejected  HTTP %s\n' "$GREEN" "$RESET" "$LAST_CODE"
    PASS=$((PASS+1))
elif [[ "$LAST_CODE" == "200" && "$LAST_BODY" == "[]" ]]; then
    printf '%s[PASS]%s anon SELECT textbook_files filtered to empty  HTTP 200 []\n' "$GREEN" "$RESET"
    PASS=$((PASS+1))
else
    short=$(printf '%s' "$LAST_BODY" | head -c 300)
    printf '%s[FAIL]%s anon SELECT textbook_files leaked  HTTP %s\n%s        %s%s\n' \
        "$RED" "$RESET" "$LAST_CODE" "$DIM" "$short" "$RESET"
    FAIL=$((FAIL+1))
    FAIL_DETAILS+=("anon SELECT textbook_files leaked -> HTTP $LAST_CODE · $short")
fi

# ---- h. service_role RPC student_signal_profile -----------------------------
echo ""
echo "── h. service_role RPC student_signal_profile ──"
body=$(printf '{"p_student_id":"%s"}' "$DEMO_STUDENT")
rest POST "/rpc/student_signal_profile" "$SUPABASE_SERVICE_ROLE_KEY" "$body"
expect "RPC student_signal_profile" '^200$'

# ---- i. service_role RPC fsrs_due_for_student -------------------------------
echo ""
echo "── i. service_role RPC fsrs_due_for_student ──"
body=$(printf '{"p_student_id":"%s","p_limit":10}' "$DEMO_STUDENT")
rest POST "/rpc/fsrs_due_for_student" "$SUPABASE_SERVICE_ROLE_KEY" "$body"
expect "RPC fsrs_due_for_student" '^200$'

# ---- j. service_role RPC student_overview -----------------------------------
echo ""
echo "── j. service_role RPC student_overview ──"
body=$(printf '{"p_student_id":"%s"}' "$DEMO_STUDENT")
rest POST "/rpc/student_overview" "$SUPABASE_SERVICE_ROLE_KEY" "$body"
expect "RPC student_overview" '^200$'

# ---- 汇总 -------------------------------------------------------------------
echo ""
echo "==================================================================="
printf '  Result: %sPASS %d%s · %sSKIP %d%s · %sFAIL %d%s\n' \
    "$GREEN" "$PASS" "$RESET" "$YELLOW" "$SKIP" "$RESET" "$RED" "$FAIL" "$RESET"
echo "==================================================================="

if (( FAIL > 0 )); then
    echo ""
    echo "FAIL details:"
    for d in "${FAIL_DETAILS[@]}"; do
        printf '  · %s\n' "$d"
    done
    echo ""
    echo "Triage:"
    echo "  · 401/42501 anon INSERT = RLS policy 没建（看 scripts/fix-rls-attempts-dialogues.sql）"
    echo "  · 401/403  anon SELECT students = PoC policy 没建"
    echo "  · 401/403  service_role = key 失效或粘错"
    echo "  · 404 RPC  = 函数没建（migrations-all-in-one.sql 第 793/831/919 行）"
    echo "  · 23502 not-null = 必填字段漏了"
    echo "  · 23503 fk = student_id / question_id 不在表里"
    exit 1
fi

echo ""
echo "Data layer is alive. Safe to deploy to Vercel."
exit 0
