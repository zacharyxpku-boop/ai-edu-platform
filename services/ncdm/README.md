# NCDM 离线训练 + Mastery API 服务

原点 AI 私教的「学生知识点掌握向量」服务。

## 它做什么

- **离线**：每天 03:00 北京时间，从 Supabase 拉所有学生的答题日志，跑 NCDM 训练，输出 `student_mastery_latest.parquet`
- **在线**：FastAPI 提供 `/api/mastery/vector?student_id=xxx` → 返回该学生在所有 KC 上的掌握度（家长端雷达图数据源）
- **推荐**：`/api/mastery/recommend` → 找 mastery 落在 0.4-0.7 ZPD 区间的 KC，做下一个学习推荐

## 它不做什么

- 不在线训模型（NCDM 训练耗时 3-8 分钟，不能上线 latency）
- 不替代 BKT（BKT 在 Vercel Edge `/api/bkt` 跑，单题级别 <1ms）
- 不直接服务前端（前端 → Vercel Edge → 调本服务）

## 架构位置

```
[ Vercel Edge ]                      [ Fly.io / Hong Kong ]
      │                                       │
      ├─ /api/bkt          (5 行 TS BKT)
      ├─ /api/diagnose     (LLM 64 类归因)
      ├─ /api/retrieve     (苏格拉底 RAG)
      └─ /api/mastery/*  ────proxy────►  本服务  ────►  Supabase Postgres
                                            │
                                            └────►  /data/parquet/*.parquet
                                            └────►  cron 03:00 train
```

## 本地启动

```bash
# 1. 装依赖（建议虚拟环境）
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 2. 准备 .env
cp .env.example .env
# 填 DATABASE_URL=postgresql://...

# 3. 第一次训（需 attempts 表已有数据）
python -m src.train

# 4. 起 FastAPI
uvicorn src.serve:app --reload --port 8000

# 5. 测试
curl "http://localhost:8000/healthz"
curl "http://localhost:8000/api/mastery/vector?student_id=<uuid>&top_k_weakest=5"
```

## 部署到 Fly.io

```bash
# 一次性
flyctl auth login
flyctl launch --no-deploy --name yuandian-ncdm
flyctl volumes create ncdm_data --size 1 --region hkg

# 设置 secret
flyctl secrets set DATABASE_URL="postgresql://..."

# 部署
flyctl deploy

# 看日志
flyctl logs
```

## 环境变量

| 变量 | 必填 | 默认 | 说明 |
|---|---|---|---|
| DATABASE_URL | 是 | — | Supabase Postgres 连接串 |
| EPOCHS | 否 | 50 | 训练轮数 |
| OUT_DIR | 否 | /data/parquet | parquet 输出目录 |
| CORS_ORIGINS | 否 | * | 前端域名白名单 |
| PORT | 否 | 8000 | FastAPI 端口 |

## 训练触发条件

- 自动：每天 03:00（容器内 cron）
- 手动：`docker exec <container> python -m src.train`
- 跳过：attempts 总数 < 1000 或单学生 attempts < 5

## 关键阈值

- **AUC ≥ 0.78** 才算可用（Agent 4 实测 toy 数据 0.623，真生产数据应 ≥0.78）
- **训练时长** 在 Fly.io 2vCPU 上：10k logs ~30s，100k logs ~5min，1M logs ~50min
- **parquet 大小** 1000 学生 × 200 KC ≈ 1.6MB，10000 学生 × 1000 KC ≈ 80MB

## 与 Vercel Edge 集成

在 ai-edu-platform 加 `/api/mastery-proxy.js`（Edge Function），把请求转发到本服务：

```js
export const config = { runtime: 'edge' };
const NCDM_HOST = process.env.NCDM_HOST; // https://yuandian-ncdm.fly.dev
export default async function handler(req) {
  const url = new URL(req.url);
  const proxied = NCDM_HOST + url.pathname.replace('/api/mastery-proxy', '/api/mastery') + url.search;
  return fetch(proxied);
}
```

前端只需 `fetch('/api/mastery-proxy/vector?student_id=xxx')`，跨域自然解决。

## Roadmap

- v1.0 (current): 50 epochs CPU 训练，parquet 持久化
- v1.5: GPU 训练（Fly.io GPU machines），EPOCHS=200
- v2.0: 增量训练（不全量重训，只追加新 attempts）
- v2.5: 多模型 ensemble（NCDM + DKT + IRT 加权）
