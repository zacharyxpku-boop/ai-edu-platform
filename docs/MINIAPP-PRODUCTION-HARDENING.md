# 原点智学小程序生产化硬化说明

## 当前生产边界

本轮硬化目标：在不增加首版上架成本的前提下，把小程序推进到“可低成本提审、可小范围真实内测”的生产边界。

已完成：

- 小程序会话端点统一签发 `session_id`，配置 `WECHAT_APP_ID` / `WECHAT_APP_SECRET` 后可切换真实微信登录。
- `priority`、`tutor-message`、`content-check` mini API 统一输入长度限制、JSON 校验、IP 限流、错误返回和 `x-mini-session` 验签。
- 测评页和作业录入页优先走服务端 `/api/mini/priority`，失败时才回退本地算法。
- 原小点发送前先走 `/api/mini/content-check`，拦截自伤风险和作业代写边界。
- “我的”页提供本地学习数据清除入口，覆盖学习档案、雷达、作业分类、会话、授权和 session。
- 新增 `npm run test:miniapp-prod`，覆盖会话签发、坏 session 拒绝、雷达生成、内容安全和 Tutor 作业边界。

## 生产环境变量

首版提审可只配置 `DEEPSEEK_KEY`，真实内测建议配置：

```text
WECHAT_APP_ID=wx...
WECHAT_APP_SECRET=...
MINI_SESSION_SECRET=至少 32 字节随机字符串，不能复用 AppSecret
DEEPSEEK_KEY=...
FEISHU_WEBHOOK_URL=可选，用于咨询通知
```

## 微信后台配置

必须配置：

```text
request 合法域名：https://yuandianzhixue.com
```

首版不配置：

```text
uploadFile 合法域名
downloadFile 合法域名
支付
自动图片识别
```

## 当前仍然不做的事

- 不承诺提分。
- 不做作业代写。
- 不销售课程。
- 不上传图片识别。
- 不把 `student_id` 当授权边界。

## 下一阶段生产化

进入 30-50 个真实家庭内测前，优先补：

- 将服务端 `priority` 结果写入 Supabase，形成学生画像历史。
- 将 Tutor 对话摘要写入 `dialogues` / `student_memory`，不要直接向家长展示完整对话。
- 接入微信官方内容安全 `msgSecCheck`，本地规则只作为前置兜底。
- 增加服务端数据删除接口，和小程序“清除本地数据”形成完整闭环。
- 给 `/api/mini/*` 增加结构化日志和错误率监控。
