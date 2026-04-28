#!/usr/bin/env bash
# sync-admin-token-to-github.sh
# 用法（Git Bash）：
#   bash scripts/sync-admin-token-to-github.sh
#
# 流程：
#   1. 检查 gh CLI 已登录（首次会让你点浏览器 OAuth · 一次性）
#   2. 从本地 .env.local 读 ADMIN_TOKEN（Vercel Sensitive CLI 拉不出来，只能用本地这份）
#   3. gh secret set 写进 GitHub repo secrets
#   4. 列出 repo secrets 验证

set -euo pipefail

PROJECT_ROOT="C:/Users/86136/Desktop/claude/ai-edu-platform"
ENV_FILE="$PROJECT_ROOT/.env.local"
REPO_SLUG="zacharyxpku-boop/ai-edu-platform"

cd "$PROJECT_ROOT"

echo "=== Step 1/3: 检查 gh CLI 登录状态 ==="
if ! gh auth status >/dev/null 2>&1; then
  echo "→ 没登 GitHub · 走浏览器 OAuth（一次性，弹浏览器点 Authorize 就行）"
  gh auth login --hostname github.com --git-protocol https --web --scopes "repo,workflow"
fi
GH_USER=$(gh api user --jq .login)
echo "✓ GitHub: $GH_USER"
echo

echo "=== Step 2/3: 从 .env.local 读 ADMIN_TOKEN ==="
if [ ! -f "$ENV_FILE" ]; then
  echo "✗ 找不到 $ENV_FILE" >&2
  exit 1
fi
TOKEN_LINE=$(grep -E '^ADMIN_TOKEN=' "$ENV_FILE" | head -1 || true)
if [ -z "$TOKEN_LINE" ]; then
  echo "✗ .env.local 里没 ADMIN_TOKEN= 这一行" >&2
  exit 1
fi
ADMIN_TOKEN=$(echo "$TOKEN_LINE" | sed 's/^ADMIN_TOKEN=//' | tr -d '"' | tr -d "'" | tr -d ' ' | tr -d '\r')
TOKEN_LEN=${#ADMIN_TOKEN}
if [ "$TOKEN_LEN" -lt 8 ]; then
  echo "✗ 读到的 token 长度异常（$TOKEN_LEN 字符）" >&2
  exit 1
fi
echo "✓ Token 长度: $TOKEN_LEN chars"
echo

echo "=== Step 3/3: 写进 GitHub repo secret ==="
printf '%s' "$ADMIN_TOKEN" | gh secret set ADMIN_TOKEN --repo "$REPO_SLUG" --body -
echo "✓ ADMIN_TOKEN 已写进 $REPO_SLUG"
echo

echo "=== 验证：列出 secrets ==="
gh secret list --repo "$REPO_SLUG"
echo

echo "🎯 全套搞定 · parent-push-scan 整点第 5 分钟会自动跑"
echo "   想立刻 trigger：gh workflow run parent-push-scan.yml --repo $REPO_SLUG"
