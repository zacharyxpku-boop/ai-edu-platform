# Vercel 部署清单 · 5.4 Demo Day 上线

5.4 之前必须做完，否则 Demo Day 无 demo。

---

## 1 · 现状盘点

| 资产 | 路径 | 状态 |
|---|---|---|
| 静态页 | `index.html` / `mastery-loop.html` / `parent-radar.html` / `admin.html` 等 19 页 | 已就绪 |
| Edge Functions | `api/bkt.js` / `api/diagnose.js` / `api/retrieve.js` / `api/mastery-proxy.js` / `api/ingest-attempt.js` / `api/log-dialogue.js` / `api/admin/summary.js` 等 12 个 | 已就绪 |
| 静态题源 | `src/curriculum/*.json` 21 个 | 已就绪 |
| `vercel.json` | 含 cleanUrls / 安全头 / redirects | 已就绪 |
| Git 仓库 | GitHub `zacharyxpku-boop/ai-edu-platform`（推断）| 检查 |

---

## 2 · 必须配的 env（Vercel Dashboard → Project Settings → Environment Variables）

| 变量 | 必需 | 说明 | 配置环境 |
|---|---|---|---|
| `QWEN_KEY` | ✓ | 已配 | All |
| `DEEPSEEK_KEY` | ✓ | 已配 | All |
| `FEISHU_WEBHOOK_URL` | 可选 | 已配 | All |
| `SUPABASE_URL` | **新增** | 你拿到的 Supabase Project URL | All |
| `SUPABASE_ANON_KEY` | **新增** | anon public key | All |
| `SUPABASE_SERVICE_ROLE_KEY` | **新增** | service_role secret · **Server-side only** | Production + Preview（不勾 Development）|
| `ADMIN_TOKEN` | **新增** | admin.html 鉴权令牌（自己定个 32 字符随机串）| Production + Preview |
| `NCDM_HOST` | 可选 | Fly.io 上 NCDM 服务地址，没部就留空 mock 兜底 | All |

**安全护栏**：
- `SUPABASE_SERVICE_ROLE_KEY` 永远不要在 Development 环境（避免本地 dev 误用导致漏库）
- `ADMIN_TOKEN` 用 `openssl rand -hex 16` 生成，存 1Password
- 所有 key 在 Vercel 配置后，**勾上 "Encrypted"**

---

## 3 · 部署步骤

### 3.1 本地预检（5 分钟）

```bash
cd C:/Users/86136/Desktop/claude/ai-edu-platform

# 装本地预览（如已装跳过）
npm install

# 本地起服务，浏览器访问 http://localhost:8080/mastery-loop
npx http-server -p 8080 -c-1

# 自检 4 页能开
# - http://localhost:8080/index.html
# - http://localhost:8080/mastery-loop.html
# - http://localhost:8080/parent-radar.html
# - http://localhost:8080/admin.html  （输入任意字符进 dashboard，跑 mock 数据）
```

### 3.2 推 Git 触发 Vercel 自动部署

```bash
cd C:/Users/86136/Desktop/claude/ai-edu-platform
git add -A
git status      # 自检要 push 哪些新文件
git commit -m "feat: BKT/diagnose/retrieve API + mastery-loop UI 升级 + parent-radar + admin 看板 + Supabase 写库管线"
git push origin main
```

Vercel 会自动检测到 push，约 1-2 分钟构建完成。

### 3.3 验证生产环境

依次访问（替换为你的真域名）：

| URL | 期待 |
|---|---|
| `https://0dianxue.com/` | 首页正常 |
| `https://0dianxue.com/mastery-loop` | 进入 25 分钟闭环页面，能做完 5 题 |
| `https://0dianxue.com/parent-radar?student_id=demo-student-001` | 显示 mock 雷达图 |
| `https://0dianxue.com/admin` | 输入 `ADMIN_TOKEN` 后能进看板 |
| `https://0dianxue.com/api/bkt` | POST 测试，返回 mastery_trace |
| `https://0dianxue.com/api/diagnose` | POST 错题，返回 64 类归因 |
| `https://0dianxue.com/api/retrieve` | POST topic，返回 system_prompt |

测试 BKT 端点（curl 一行）：
```bash
curl -X POST https://0dianxue.com/api/bkt \
  -H "Content-Type: application/json" \
  -d '{"current_mastery":0.3,"attempts":[{"is_correct":false,"difficulty":0.5},{"is_correct":true,"difficulty":0.5},{"is_correct":true,"difficulty":0.5},{"is_correct":true,"difficulty":0.5}]}'
```

期待返回 `mastered: true` 和 `final_mastery >= 0.9`。

---

## 4 · 域名与 redirect

`vercel.json` 已配的 redirect：
- `/methods` → `/assistant`
- `/about-brand` → `/about`

**新加 redirect 建议**（更短的入口给 Demo Day 用）：
```json
{
  "source": "/start",
  "destination": "/mastery-loop"
},
{
  "source": "/parent",
  "destination": "/parent-radar"
}
```

让家长扫码进 `https://0dianxue.com/start?code=XXX&name=小明` 直接到 mastery-loop。

---

## 5 · 5.4 Demo Day 现场预案

### 5.4 现场设备 checklist（结营前 1 小时）

- [ ] 笔记本浏览器开 `https://0dianxue.com/mastery-loop` 提前预热
- [ ] 关掉浏览器其他 tab（避免提示干扰）
- [ ] 备用 4G 热点（北大中关 wifi 不稳）
- [ ] 备一份本地版 mastery-loop.html（U 盘 + 离线模式）
- [ ] 投影屏幕分辨率试一遍（mastery-loop UI 在 1920×1080 ok 但小屏 1024×768 字会挤）

### Demo 演示链路

孩子上台 → 浏览器 `/start` → 做题 → BKT 调用 → 出师奖章弹（mastery ≥ 0.9）→ 「炫耀给爸妈看」按钮按下 → 朋友圈卡片弹出。**全程无后端依赖，bkt/diagnose API 失败也能跑（前端兜底已写）**。

### 翻车应急

| 问题 | 处理 |
|---|---|
| `/api/bkt` 503 | mastery-loop 已写本地兜底（localBKT），照样能跑 |
| `/api/diagnose` 超时 | 答错时回退到本地 `q.hint`，看不出来 |
| 整站 down | 切到提前录的 90 秒 demo 视频备播 |
| Supabase ingest 失败 | 浏览器 console 有 ingest skipped 日志，但 UI 不受影响 |

---

## 6 · 部署后第一周监控

5.5 - 5.11，每天看的指标（admin.html）：

| 指标 | 阈值 | 触发动作 |
|---|---|---|
| 今日活跃 / 总学员 | < 60% | 私信干预未活跃名单 |
| 闭环完成率 | < 50% | review 题序难度 |
| 错题率 | > 60% | 调降 difficulty 0.1 |
| W4 留存预测 | < 60% | 紧急复盘 onboarding |

每天 21:00 看一次，10 分钟。

---

## 7 · 不要做的事

- ❌ **不要** push `.env.local` 到 Git（已在 .gitignore，但每次 commit 都自查）
- ❌ **不要** 把 `SUPABASE_SERVICE_ROLE_KEY` 写进 HTML / 客户端 JS
- ❌ **不要** 在生产环境前没跑完 0001 + 0002 + 0003 三个 migration
- ❌ **不要** 上线前少做「本地预检 3.1」这步
- ❌ **不要** 在 Demo Day 当天 push 新代码（Vercel build 失败会让 demo 直接 down）

---

**版本**：v1.0 · 2026-04-26
**关联**：BATTLEPLAN.md / CAMP_DEMO_DAY_SCRIPT.md / INTERNAL_TEST_ONBOARDING.md
