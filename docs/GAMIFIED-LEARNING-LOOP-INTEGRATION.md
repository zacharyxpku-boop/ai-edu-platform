# 游戏化学习闭环集成说明

## 架构适配

当前仓库不是 React + Next + Prisma 项目，而是官网静态页、微信小程序和 `api/mini` Edge API。实现按现有架构落地：

- 小程序本地 Storage 保存真实卡片、复习事件、XP、学币、成就和库存。
- `api/mini` 提供游戏化学习合同：复习、测验、成就、商店、排行榜、报告。
- 规格同名 API 已补兼容入口，如 `/api/decks`、`/api/review/due-cards`、`/api/quiz/generate`。
- 未配置真实 AppID 和云同步前，不展示全校榜/好友榜，不生成假社交数据。

## 核心文件

- `src/lib/game-logic.cjs`：Node 测试用纯游戏逻辑。
- `miniprogram/utils/game-logic.js`：小程序端同款规则。
- `api/mini/_game.js`：Edge API 端游戏逻辑。
- `miniprogram/utils/review-cards.js`：复习卡、FSRS/SM-2 调度、XP、成就、错因修复汇总。
- `miniprogram/pages/home/*`：今晚首页展示今日任务、XP、生命值、连续天、奖励、下一关。
- `miniprogram/pages/review/*`：5 分钟复习闯关、翻卡、自评、测验和奖励领取。
- `miniprogram/pages/profile/*`：家长/档案侧展示等级、学币、连续天、徽章和本地榜说明。
- `docs/GAME-LEARNING-SCHEMA.sql`：启用 Supabase/PostgreSQL 后的持久化 schema。

## API 对照

| 规格 API | 当前实现 |
| --- | --- |
| `POST /api/decks` | 从用户提交的真实文本生成卡组和闪卡，不保存假卡 |
| `GET /api/decks/:id/cards` | 未配置云库时返回空合同；可 POST 真实本地 cards 过滤 |
| `GET /api/review/due-cards` | 返回请求中真实 cards 的到期卡 |
| `POST /api/review/record` | 兼容 `review-grade`，返回 SM-2 调度和 XP |
| `GET/POST /api/review/today` | 小程序主用今日复习合同 |
| `POST /api/quiz/generate` | 基于真实 cards 生成小测 |
| `POST /api/quiz/submit` | 统计正确率、XP 和错因修复建议 |
| `GET /api/achievements` | 成就墙合同 |
| `GET /api/leaderboard` | 无云同步时只返回本地榜 |
| `GET /api/shop/items` | 学币商店，只提供装饰/补签 |
| `POST /api/shop/purchase` | 学币兑换，不支持人民币 |
| `GET /api/report/weekly` | 家长周报摘要 |
| `GET /api/report/knowledge-gap` | 错因/知识缺口 |
| `POST /api/parent/bind` | 自愿家长绑定合同 |
| `GET /api/parent/child-stats` | 家长侧真实学习统计摘要 |

## 产品边界

- 教材资产只能用于版本/章节/知识点定位，不公开分发教材 PDF 原文。
- 排行榜在没有真实 AppID、openid_hash、cohort_id 和云同步前只显示本地进度。
- 商店只卖装饰性道具和补签卡，不卖分数优势，不支持充值。
- 家长端只展示学习证据摘要，不返回孩子私密对话全文。

## 100 人体验前仍需配置

1. 真实微信 AppID，并重新运行 `npm run miniapp:appid -- wx你的AppID`。
2. `MINI_SESSION_SECRET`，避免长期依赖 demo/local token。
3. Supabase 或等价云端持久化，用 `docs/GAME-LEARNING-SCHEMA.sql` 建表。
4. 按 `openid_hash/client_id/cohort_id` 聚合 XP、复习日志和反馈。
