#!/bin/bash
# 同时启动 cron + uvicorn
set -e

# cron 接环境变量（需要把 host env 写到 cron-readable 文件）
printenv | grep -E "^(DATABASE_URL|EPOCHS|OUT_DIR|CORS_ORIGINS)=" > /etc/environment

# 启动 cron
service cron start
echo "[entrypoint] cron started"

# 首次启动时立刻训一次（如果 parquet 不存在）
if [ ! -f "${OUT_DIR:-/data/parquet}/student_mastery_latest.parquet" ]; then
    echo "[entrypoint] no parquet found, run first training..."
    python -m src.train || echo "[entrypoint] first train failed (DB may be empty), serve will still start"
fi

# 起 FastAPI（前台进程）
exec uvicorn src.serve:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1 --access-log
