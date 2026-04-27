# NCDM 离线服务 · Yuandian AI Coach
# 用途：nightly cron 从 Supabase 拉答题日志 → 训 NCDM → 持久化 student_emb parquet
#       FastAPI 提供 /api/mastery/vector 接口给前端雷达图
#
# 部署：Fly.io（推荐）/ Railway / 自建 VPS
# 镜像大小：~1.4GB（torch CPU + EduCDM + duckdb + pandas）
FROM python:3.10-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple

WORKDIR /app

# 系统依赖（torch CPU 不需要 CUDA libs）
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cron curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY src/ ./src/
COPY scripts/ ./scripts/

# 持久化目录（挂卷使用）
RUN mkdir -p /data/parquet /data/logs /data/checkpoints

# nightly cron：每天 03:00 训一次
COPY scripts/crontab /etc/cron.d/ncdm-cron
RUN chmod 0644 /etc/cron.d/ncdm-cron && crontab /etc/cron.d/ncdm-cron

EXPOSE 8000

# entrypoint 同时启 cron + FastAPI
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
