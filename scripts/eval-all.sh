#!/usr/bin/env bash
# 原点智学 · 一键跑 A+B+C 三件评测
#
# 用法：
#   PROD_HOST=https://yuandianzhixue.com \
#   STUDENT_ID=00000000-0000-0000-0000-000000000001 \
#   DEEPSEEK_KEY=sk-xxx \
#       bash scripts/eval-all.sh
#
# 跳过某件：SKIP_A=1 SKIP_B=1 SKIP_C=1 任一组合
#
# 输出：data/eval/runs/<timestamp>/{a,b,c}.log + summary.txt
# 退出码：3 件全过 = 0；任一失败 = 非 0
#
# 设计意图：
#   prompt 改一版后跑一次 → 拿到「跟上一版相比哪一项变好/变差」的真实数据。
#   PoC 期 5.4 之前每天跑一次，结果按时间归档，回看曲线判断 prompt 演进方向是否正确。

set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

PROD_HOST="${PROD_HOST:-https://yuandianzhixue.com}"
STUDENT_ID="${STUDENT_ID:-00000000-0000-0000-0000-000000000001}"
DEEPSEEK_KEY="${DEEPSEEK_KEY:-${DEEPSEEK_API_KEY:-}}"

TS=$(date +%Y%m%d-%H%M%S)
OUT_DIR="data/eval/runs/$TS"
mkdir -p "$OUT_DIR"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
RESET='\033[0m'

A_RESULT="-"
B_RESULT="-"
C_RESULT="-"

echo "=========================================="
echo "  原点智学 · eval-all"
echo "  时间戳: $TS"
echo "  PROD_HOST: $PROD_HOST"
echo "  STUDENT_ID: $STUDENT_ID"
echo "  归档: $OUT_DIR"
echo "=========================================="
echo ""

# ─── A: tutor prompt 跟随率 ───────────────────────────
if [ "${SKIP_A:-0}" != "1" ]; then
    echo -e "${YELLOW}[A] tutor-chat prompt 跟随率评测${RESET}"
    PROD_HOST="$PROD_HOST" STUDENT_ID="$STUDENT_ID" \
        python3 scripts/eval-tutor-prompt.py 2>&1 | tee "$OUT_DIR/a.log"
    A_CODE=${PIPESTATUS[0]}
    if [ "$A_CODE" -eq 0 ]; then A_RESULT="PASS"; else A_RESULT="FAIL"; fi
    echo ""
else
    echo "[A] 已跳过 (SKIP_A=1)"
    A_RESULT="SKIP"
fi

# ─── B: 6 字段抽取准确率 ────────────────────────────
if [ "${SKIP_B:-0}" != "1" ]; then
    if [ -z "$DEEPSEEK_KEY" ]; then
        echo -e "${RED}[B] 跳过：DEEPSEEK_KEY 未设${RESET}"
        B_RESULT="SKIP_NOENV"
    else
        echo -e "${YELLOW}[B] extract-dialogue-signals 抽取准确率评测${RESET}"
        DEEPSEEK_KEY="$DEEPSEEK_KEY" \
            python3 scripts/eval-extract-signals.py 2>&1 | tee "$OUT_DIR/b.log"
        B_CODE=${PIPESTATUS[0]}
        if [ "$B_CODE" -eq 0 ]; then B_RESULT="PASS"; else B_RESULT="FAIL"; fi
    fi
    echo ""
else
    echo "[B] 已跳过 (SKIP_B=1)"
    B_RESULT="SKIP"
fi

# ─── C: 30 题 diagnose 归因 ─────────────────────────
if [ "${SKIP_C:-0}" != "1" ]; then
    echo -e "${YELLOW}[C] diagnose 错题归因评测${RESET}"
    PROD_HOST="$PROD_HOST" \
        python3 scripts/eval-diagnose.py 2>&1 | tee "$OUT_DIR/c.log"
    C_CODE=${PIPESTATUS[0]}
    if [ "$C_CODE" -eq 0 ]; then C_RESULT="PASS"; else C_RESULT="FAIL"; fi
    echo ""
else
    echo "[C] 已跳过 (SKIP_C=1)"
    C_RESULT="SKIP"
fi

# ─── summary ─────────────────────────────────────
SUMMARY_FILE="$OUT_DIR/summary.txt"
{
    echo "原点智学评测汇总 · $TS"
    echo "PROD_HOST: $PROD_HOST"
    echo ""
    echo "A · tutor prompt 跟随率: $A_RESULT"
    echo "B · 6 字段抽取准确率:    $B_RESULT"
    echo "C · diagnose 归因准确率: $C_RESULT"
} | tee "$SUMMARY_FILE"

echo ""
echo "=========================================="
echo "归档完成: $OUT_DIR/"
echo "  · a.log  · b.log  · c.log  · summary.txt"
echo "=========================================="

# 退出码：任一 FAIL = 非 0
case "$A_RESULT$B_RESULT$C_RESULT" in
    *FAIL*) exit 1 ;;
    *) exit 0 ;;
esac
