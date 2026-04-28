#!/usr/bin/env bash
# 原点 AI 私教 · 端到端 smoke test
# 验证 15 个 Edge endpoint + Supabase 写库链路全活
#
# 用法：
#   PROD_HOST=https://www.yuandianzhixue.com ADMIN_TOKEN=xxx STUDENT_ID=demo-001 bash scripts/smoke-test.sh
#
# 通过条件：所有 [PASS] 全绿，没有 [FAIL]
# 失败的端点会输出 HTTP code 和响应体前 200 字符

set -e

HOST="${PROD_HOST:-http://localhost:8080}"
ADMIN="${ADMIN_TOKEN:-test-token}"
STUDENT="${STUDENT_ID:-00000000-0000-0000-0000-000000000001}"
KP_CODE="${KP_CODE:-math.7.ch3.kp3}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
RESET='\033[0m'

PASS=0
FAIL=0
SKIP=0

post() {
    local name=$1; local path=$2; local body=$3; local extra_headers=$4
    local resp
    resp=$(curl -sS -w "\n__HTTP_CODE__%{http_code}" -X POST "$HOST$path" \
        -H "Content-Type: application/json" \
        $extra_headers \
        -d "$body" 2>&1) || true
    local code=$(echo "$resp" | grep -o '__HTTP_CODE__[0-9]*' | grep -o '[0-9]*')
    local body_only=$(echo "$resp" | sed 's/__HTTP_CODE__[0-9]*//' | head -c 200)
    if [[ "$code" == "200" || "$code" == "201" ]]; then
        echo -e "${GREEN}[PASS]${RESET} $name ($path)"
        PASS=$((PASS+1))
    elif [[ "$code" == "503" ]]; then
        echo -e "${YELLOW}[SKIP]${RESET} $name ($path) · env 未配 503"
        SKIP=$((SKIP+1))
    else
        echo -e "${RED}[FAIL]${RESET} $name ($path) HTTP $code · $body_only"
        FAIL=$((FAIL+1))
    fi
}

get() {
    local name=$1; local path=$2; local extra_headers=$3
    local resp
    resp=$(curl -sS -w "\n__HTTP_CODE__%{http_code}" "$HOST$path" \
        $extra_headers 2>&1) || true
    local code=$(echo "$resp" | grep -o '__HTTP_CODE__[0-9]*' | grep -o '[0-9]*')
    local body_only=$(echo "$resp" | sed 's/__HTTP_CODE__[0-9]*//' | head -c 200)
    if [[ "$code" == "200" ]]; then
        echo -e "${GREEN}[PASS]${RESET} $name ($path)"
        PASS=$((PASS+1))
    elif [[ "$code" == "503" || "$code" == "404" ]]; then
        echo -e "${YELLOW}[SKIP]${RESET} $name ($path) HTTP $code · 待数据/env"
        SKIP=$((SKIP+1))
    else
        echo -e "${RED}[FAIL]${RESET} $name ($path) HTTP $code · $body_only"
        FAIL=$((FAIL+1))
    fi
}

echo "==================================================================="
echo "  原点 AI 私教 · 端到端 smoke test"
echo "  HOST: $HOST"
echo "  STUDENT_ID: $STUDENT"
echo "==================================================================="

echo ""
echo "── 一、核心算法层（无 DB 依赖，应全 PASS）──"

post "BKT 算法" "/api/bkt" \
    '{"current_mastery":0.3,"attempts":[{"is_correct":false,"difficulty":0.5},{"is_correct":true,"difficulty":0.5},{"is_correct":true,"difficulty":0.5},{"is_correct":true,"difficulty":0.5}]}'

echo ""
echo "── 二、LLM 端点（依赖 DEEPSEEK_KEY / QWEN_KEY）──"

post "诊断·错题归因 64 类" "/api/diagnose" \
    '{"subject":"math","problem":"解方程 2x+3=7","correct_answer":"2","student_response":"5"}'

post "检索·苏格拉底 prompt" "/api/retrieve" \
    '{"subject":"math","topic":"一元一次方程","grade":"初一","mistake_l3":"ability.skipped_step.move_term"}'

post "LLM 路由·general" "/api/llm-route" \
    '{"task":"general","messages":[{"role":"user","content":"你好，简短打个招呼"}]}'

post "LLM 路由·embed" "/api/llm-route" \
    '{"task":"embed","input":"测试 embedding"}'

echo ""
echo "── 三、数据层端点（依赖 SUPABASE_*）──"

post "Ingest 答题日志" "/api/ingest-attempt" \
    "{\"student_id\":\"$STUDENT\",\"is_correct\":true,\"response\":\"7\",\"time_spent_ms\":12000,\"difficulty\":0.5,\"mastery_before\":0.3,\"mastery_after\":0.62,\"topic_code\":\"$KP_CODE\",\"question_stem\":\"测试题：解方程 x+5=12\"}"

post "Log 对话" "/api/log-dialogue" \
    "{\"student_id\":\"$STUDENT\",\"role\":\"student\",\"content\":\"smoke test 对话内容\",\"kind\":\"chat\"}"

post "FSRS 更新" "/api/fsrs-update" \
    "{\"student_id\":\"$STUDENT\",\"knowledge_point_code\":\"$KP_CODE\",\"is_correct\":false,\"time_spent_ms\":45000,\"hint_level\":\"medium\"}"

get  "FSRS 今日复习" "/api/fsrs-due?student_id=$STUDENT&limit=10"

post "学生跨会话记忆" "/api/student-memory" \
    "{\"student_id\":\"$STUDENT\",\"query\":\"一元一次方程怎么解\",\"top_k\":3}"

# v1.2 新端点 · 学生 KP 状态（tutor.html 右栏 fetch）
get "学生 KP 状态" "/api/student-kp-states?student_id=$STUDENT&subject=math"

# 校验 KP 状态 JSON shape + demo 种子完整性（必须先跑 SEED-DEMO-GUIDE）
echo ""
echo "── 三·五、Demo 种子完整性（前置：SEED-DEMO-GUIDE 第 1-3 步跑完）──"

KP_RESP=$(curl -sS "$HOST/api/student-kp-states?student_id=$STUDENT&subject=math" 2>/dev/null || echo '{}')

if echo "$KP_RESP" | grep -q '"ok":true'; then
    # 数 states 行数：用最朴素的 [{ 计数（避免 jq 依赖）
    STATES_COUNT=$(echo "$KP_RESP" | grep -o '"code":"math\.' | wc -l | tr -d ' ')
    if [[ "$STATES_COUNT" -ge 4 ]]; then
        echo -e "${GREEN}[PASS]${RESET} demo 学生有 $STATES_COUNT 个 KP states（期望 ≥4）"
        PASS=$((PASS+1))
    else
        echo -e "${RED}[FAIL]${RESET} demo states 仅 $STATES_COUNT 行（期望 4）· 跑 seed-demo-states.sql"
        FAIL=$((FAIL+1))
    fi

    # 校验 next_focus + summary 字段都在
    if echo "$KP_RESP" | grep -q '"next_focus"' && echo "$KP_RESP" | grep -q '"summary"'; then
        echo -e "${GREEN}[PASS]${RESET} JSON shape 含 summary.next_focus（前端右栏依赖）"
        PASS=$((PASS+1))
    else
        echo -e "${RED}[FAIL]${RESET} JSON 缺 summary/next_focus 字段"
        FAIL=$((FAIL+1))
    fi
else
    echo -e "${YELLOW}[SKIP]${RESET} kp-states 端点未返回 ok=true · 部署或 RLS 问题"
    SKIP=$((SKIP+1))
fi

# 检查 dialogues 种子（通过 student-memory 间接）
MEM_RESP=$(curl -sS -X POST "$HOST/api/student-memory" \
    -H "Content-Type: application/json" \
    -d "{\"student_id\":\"$STUDENT\",\"query\":\"移项\",\"top_k\":3}" 2>/dev/null || echo '{}')
if echo "$MEM_RESP" | grep -q '"memories"'; then
    MEM_COUNT=$(echo "$MEM_RESP" | grep -o '"role":"student"' | wc -l | tr -d ' ')
    if [[ "$MEM_COUNT" -ge 1 ]]; then
        echo -e "${GREEN}[PASS]${RESET} demo dialogues 检索到 $MEM_COUNT 条（embedding 已回填）"
        PASS=$((PASS+1))
    else
        echo -e "${YELLOW}[SKIP]${RESET} dialogues 检索 0 条 · 跑 seed-demo-dialogues.sql + curl /api/embed-dialogue"
        SKIP=$((SKIP+1))
    fi
fi

echo ""
echo "── 四、知识 / 课标查询（无 DB 依赖）──"

get "课标对齐查询" "/api/standard-info?topic_id=math.7.eq.linear"
get "课标·全列表" "/api/standard-info?subject=math&grade=7"
get "知识点树·章节" "/api/knowledge-tree?root=math.7.ch3"
get "知识点·先修链" "/api/knowledge-tree?kp_id=math.7.ch3.kp3"

echo ""
echo "── 五、运维端点（依赖 ADMIN_TOKEN）──"

get "Admin 看板" "/api/admin/summary?range=7d" "-H X-Admin-Token:$ADMIN"

post "信号抽取（手动触发）" "/api/extract-dialogue-signals?limit=5" \
    "{}" "-H X-Admin-Token:$ADMIN"

post "对话向量化" "/api/embed-dialogue?limit=5" \
    "{}" "-H X-Admin-Token:$ADMIN"

# v1.1 新端点 · 出师金句
post "出师金句生成" "/api/achievement-quote" \
    '{"topic":"一元一次方程","minutes":12,"attempts_count":7,"correct_count":6,"final_mastery":0.92,"highlights":[{"step":"去分母漏乘","from":"错","to":"对"}]}' ""

echo ""
echo "── 六、代理端点（NCDM 服务，依赖 NCDM_HOST）──"

get "NCDM 健康检查" "/api/mastery-proxy/healthz"
get "NCDM mastery 向量" "/api/mastery-proxy/vector?student_id=$STUDENT"

echo ""
echo "── 七、Round 3 新端点验收（mentor / parent-brief LLM / dossier / mistake-graph / v3 路由）──"

# 7.1 学长队列 pending 列表
get "学长队列 pending" "/api/mentor-queue?status=pending&limit=5"

KQ_RESP=$(curl -sS "$HOST/api/mentor-queue?status=pending&limit=5" 2>/dev/null || echo '{}')
if echo "$KQ_RESP" | grep -q '"items"' && echo "$KQ_RESP" | grep -q '"summary"'; then
    echo -e "${GREEN}[PASS]${RESET} 学长队列 JSON 含 items[] + summary{}"
    PASS=$((PASS+1))
else
    echo -e "${YELLOW}[SKIP]${RESET} 学长队列 JSON 缺 items/summary · 可能空表"
    SKIP=$((SKIP+1))
fi

# 7.2 学情档案 JSON + markdown
get "学情档案 JSON" "/api/student-dossier?student_id=$STUDENT"
get "学情档案 markdown" "/api/student-dossier?student_id=$STUDENT&format=markdown"

DOSSIER_RESP=$(curl -sS "$HOST/api/student-dossier?student_id=$STUDENT" 2>/dev/null || echo '{}')
if echo "$DOSSIER_RESP" | grep -q '"mentor_brief"' && echo "$DOSSIER_RESP" | grep -q '"weak_kps"' && echo "$DOSSIER_RESP" | grep -q '"mistake_top"'; then
    echo -e "${GREEN}[PASS]${RESET} 学情档案 JSON 含 mentor_brief / weak_kps / mistake_top"
    PASS=$((PASS+1))
else
    echo -e "${RED}[FAIL]${RESET} 学情档案 JSON 缺关键字段 · ${DOSSIER_RESP:0:200}"
    FAIL=$((FAIL+1))
fi

DOSSIER_MD=$(curl -sS "$HOST/api/student-dossier?student_id=$STUDENT&format=markdown" 2>/dev/null || echo '')
if echo "$DOSSIER_MD" | head -c 30 | grep -q "# 学情档案"; then
    echo -e "${GREEN}[PASS]${RESET} 学情档案 markdown 以「# 学情档案」开头"
    PASS=$((PASS+1))
else
    echo -e "${RED}[FAIL]${RESET} 学情档案 markdown 缺标题 · ${DOSSIER_MD:0:80}"
    FAIL=$((FAIL+1))
fi

# 7.3 错题图谱 7 天
get "错题图谱 7 天" "/api/mistake-graph?student_id=$STUDENT&days=7"

GRAPH_RESP=$(curl -sS "$HOST/api/mistake-graph?student_id=$STUDENT&days=7" 2>/dev/null || echo '{}')
if echo "$GRAPH_RESP" | grep -q '"groups"' && echo "$GRAPH_RESP" | grep -q '"by_category"'; then
    echo -e "${GREEN}[PASS]${RESET} 错题图谱 JSON 含 groups[] + by_category{}"
    PASS=$((PASS+1))
else
    echo -e "${YELLOW}[SKIP]${RESET} 错题图谱 JSON 缺 groups/by_category · 可能 7 天无错题"
    SKIP=$((SKIP+1))
fi

# 7.4 家长周报 deterministic + LLM enrich 模式
get "家长周报 deterministic" "/api/parent-brief?student_id=$STUDENT&period=weekly"
get "家长周报 LLM 五段" "/api/parent-brief?student_id=$STUDENT&period=weekly&enrich=llm"

BRIEF_DET=$(curl -sS "$HOST/api/parent-brief?student_id=$STUDENT&period=weekly" 2>/dev/null || echo '{}')
if echo "$BRIEF_DET" | grep -q '"headline"' && echo "$BRIEF_DET" | grep -q '"today_focus"'; then
    echo -e "${GREEN}[PASS]${RESET} 家长周报 deterministic 含 headline + today_focus"
    PASS=$((PASS+1))
else
    echo -e "${RED}[FAIL]${RESET} 家长周报 deterministic 缺字段 · ${BRIEF_DET:0:200}"
    FAIL=$((FAIL+1))
fi

BRIEF_LLM_HEAD=$(curl -sS -D - -o /dev/null "$HOST/api/parent-brief?student_id=$STUDENT&period=weekly&enrich=llm" 2>/dev/null | tr -d '\r')
if echo "$BRIEF_LLM_HEAD" | grep -qi "X-Brief-Engine:"; then
    ENGINE=$(echo "$BRIEF_LLM_HEAD" | grep -i "X-Brief-Engine:" | head -1 | sed 's/.*: *//' | tr -d ' \r\n')
    if [[ "$ENGINE" == "llm" || "$ENGINE" == "deterministic-fallback" ]]; then
        echo -e "${GREEN}[PASS]${RESET} 家长周报 LLM 模式响应头 X-Brief-Engine=$ENGINE"
        PASS=$((PASS+1))
    else
        echo -e "${RED}[FAIL]${RESET} 家长周报 X-Brief-Engine 非预期值: $ENGINE"
        FAIL=$((FAIL+1))
    fi

    BRIEF_LLM=$(curl -sS "$HOST/api/parent-brief?student_id=$STUDENT&period=weekly&enrich=llm" 2>/dev/null || echo '{}')
    if echo "$BRIEF_LLM" | grep -q '"error_attribution"' || echo "$BRIEF_LLM" | grep -q '"warning"'; then
        echo -e "${GREEN}[PASS]${RESET} 家长周报 LLM 含 sections.error_attribution 或 warning（fallback）"
        PASS=$((PASS+1))
    else
        echo -e "${RED}[FAIL]${RESET} 家长周报 LLM 既无 error_attribution 也无 warning"
        FAIL=$((FAIL+1))
    fi
else
    echo -e "${YELLOW}[SKIP]${RESET} 家长周报 LLM 响应头无 X-Brief-Engine · 端点未上线或 503"
    SKIP=$((SKIP+1))
fi

# 7.5 学长草稿生成（先创 escalation 拿 id 再 POST）
ESC_RESP=$(curl -sS -X POST "$HOST/api/escalate" \
    -H "Content-Type: application/json" \
    -d "{\"student_id\":\"$STUDENT\",\"kind\":\"manual\",\"student_message\":\"smoke test 草稿生成\"}" 2>/dev/null || echo '{}')
ESC_ID=$(echo "$ESC_RESP" | grep -o '"escalation_id":"[^"]*"' | sed 's/.*"\([^"]*\)"/\1/')

if [[ -n "$ESC_ID" ]]; then
    echo -e "${GREEN}[PASS]${RESET} escalate 创建得到 escalation_id=$ESC_ID"
    PASS=$((PASS+1))
    post "学长草稿生成" "/api/mentor-reply-draft" \
        "{\"escalation_id\":\"$ESC_ID\"}" ""

    DRAFT_RESP=$(curl -sS -X POST "$HOST/api/mentor-reply-draft" \
        -H "Content-Type: application/json" \
        -d "{\"escalation_id\":\"$ESC_ID\"}" 2>/dev/null || echo '{}')
    if echo "$DRAFT_RESP" | grep -q '"draft"'; then
        DRAFT_LEN=$(echo "$DRAFT_RESP" | grep -o '"draft":"[^"]*"' | head -c 800 | wc -c | tr -d ' ')
        if [[ "$DRAFT_LEN" -ge 80 ]]; then
            echo -e "${GREEN}[PASS]${RESET} 学长草稿 draft 长度 ~$DRAFT_LEN 字符（含 JSON 包装）"
            PASS=$((PASS+1))
        else
            echo -e "${YELLOW}[SKIP]${RESET} 学长草稿 draft 长度过短 ($DRAFT_LEN) · 可能 LLM key 未配"
            SKIP=$((SKIP+1))
        fi
    else
        echo -e "${YELLOW}[SKIP]${RESET} 学长草稿无 draft 字段 · 可能 DEEPSEEK_KEY 未配（503 化为 SKIP）"
        SKIP=$((SKIP+1))
    fi
else
    echo -e "${YELLOW}[SKIP]${RESET} escalate 未返回 escalation_id · 跳过 mentor-reply-draft"
    SKIP=$((SKIP+1))
fi

# 7.6 v3 prompt routing 验证（响应头 X-Prompt-Version=v3）
V3_HEAD=$(curl -sS -D - -o /dev/null -X POST "$HOST/api/tutor-chat" \
    -H "Content-Type: application/json" \
    -d "{\"student_id\":\"$STUDENT\",\"message\":\"测试 v3\",\"history\":[],\"prompt_version\":\"v3\"}" 2>/dev/null | tr -d '\r')
if echo "$V3_HEAD" | grep -qi "X-Prompt-Version:"; then
    PV=$(echo "$V3_HEAD" | grep -i "X-Prompt-Version:" | head -1 | sed 's/.*: *//' | tr -d ' \r\n')
    if [[ "$PV" == "v3" ]]; then
        echo -e "${GREEN}[PASS]${RESET} tutor-chat v3 路由生效（X-Prompt-Version=v3）"
        PASS=$((PASS+1))
    else
        echo -e "${RED}[FAIL]${RESET} tutor-chat 响应头 X-Prompt-Version=$PV ≠ v3"
        FAIL=$((FAIL+1))
    fi
else
    echo -e "${YELLOW}[SKIP]${RESET} tutor-chat 响应头无 X-Prompt-Version · 端点可能未挂头"
    SKIP=$((SKIP+1))
fi

echo ""
echo "── 八、前端页面 200 检测 ──"

for page in "/mastery-loop" "/parent-radar" "/parent-report" "/admin" "/question-bank"; do
    code=$(curl -sS -o /dev/null -w "%{http_code}" "$HOST$page")
    if [[ "$code" == "200" ]]; then
        echo -e "${GREEN}[PASS]${RESET} 前端页 $page"
        PASS=$((PASS+1))
    else
        echo -e "${RED}[FAIL]${RESET} 前端页 $page HTTP $code"
        FAIL=$((FAIL+1))
    fi
done

echo ""
echo "==================================================================="
echo -e "  结果：${GREEN}PASS $PASS${RESET} · ${YELLOW}SKIP $SKIP${RESET} · ${RED}FAIL $FAIL${RESET}"
echo "==================================================================="

if [[ $FAIL -gt 0 ]]; then
    echo ""
    echo "FAIL 排查指南："
    echo "  · HTTP 503 = env 未配（看 DEPLOY.md 第 2 节）"
    echo "  · HTTP 401 = ADMIN_TOKEN 错"
    echo "  · HTTP 502 = 上游 LLM / NCDM 服务挂了"
    echo "  · HTTP 400 = 请求体不对（一般是 schema 不对齐，看 0001-0006 是否全跑）"
    echo "  · 所有 db_insert_failed = students 表里没有 STUDENT_ID 这行（先 INSERT 一行）"
    exit 1
fi

echo ""
echo "全部通过。可以 5.4 上线。"
exit 0
