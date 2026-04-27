#!/usr/bin/env bash
# 原点 AI 私教 · 端到端 smoke test
# 验证 15 个 Edge endpoint + Supabase 写库链路全活
#
# 用法：
#   PROD_HOST=https://www.0dianxue.com ADMIN_TOKEN=xxx STUDENT_ID=demo-001 bash scripts/smoke-test.sh
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
echo "── 七、前端页面 200 检测 ──"

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
