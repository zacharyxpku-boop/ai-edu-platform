# 转化漏斗部署 checklist · v1

提交 `4deac1b` 上线后, 完整的从 home 到加微信/留电话的转化路径需要以下条件齐全才能跑通。

## 一. 必须配置的 Vercel 环境变量

进 Vercel Dashboard → Project Settings → Environment Variables, 至少配以下两个 (Production + Preview + Development 三档都建议加):

| 变量名 | 用途 | 取值来源 |
|---|---|---|
| `OPENAI_API_KEY` | 诊断报告调 GPT-4o-mini (`api/openai-diagnose.js`) | OpenAI 控制台 sk-proj-... |
| `FEISHU_WEBHOOK_URL` | 留资 lead 提交转飞书机器人 (`api/lead.js`) | 飞书群机器人 webhook URL |

**当前状态** (本地 `vercel env ls` 检查):

- ✅ `OPENAI_API_KEY` 已上 Production + Development
- ❌ `FEISHU_WEBHOOK_URL` 未配置 — 用户提交手机号会被 swallow (前端仍显示成功), 但飞书不会收到通知。需补。

如果暂时没有飞书机器人, 也可以在 `api/lead.js` 改为转其他 webhook (企业微信 / 钉钉 / Slack / 自建 endpoint), 改 url 即可。

## 二. 微信二维码占位 → 真二维码替换

`src/wechat-cta.js` 第 22-78 行硬编码了一个 SVG 二维码占位 (墨绿+砖红风格, 像素风假码). **生产环境必须替换为真客服微信二维码**。

替换步骤:

1. 客服微信→添加好友→我的二维码→保存图片
2. 把图片放到 `public/wechat-qr.png` (或 `assets/wechat-qr.png`)
3. 改 `src/wechat-cta.js` 中 `WECHAT_QR_SVG` 常量, 改为 `'/wechat-qr.png'` 字符串 (而不是 data: URI)
4. 改 modal 内的微信号文本 `yuandian-zhixue` 为真客服微信 ID

## 三. 漏斗结构

```
首页 / index.html
├─ Hero CTA "开始 3 分钟诊断" → /welcome (路径 1: 真诊断流)
├─ Hero "已诊断过 · 查看我的报告" → /report
├─ 学员故事卡 CTA → wechat-cta modal (路径 2: 直接加微信)
├─ Pricing 三档卡片 → wechat-cta modal
└─ Trust bar / Footer

诊断流 (路径 1)
welcome.html (填年级/姓名)
  └─ submit → POST /api/student-init → setItem 本地 → redirect /diagnose
diagnose.html (10 题)
  └─ 答完 → POST /api/openai-diagnose → setItem yd:diagnose_report → redirect /report
report.html
  ├─ 13 维度卡片可视化
  ├─ AI 给的 recommendation
  ├─ match_product 大卡片 → wechat-cta modal (主转化点)
  ├─ 另两档 alt-row → wechat-cta modal
  └─ sticky bottom CTA (滚动后弹出) → wechat-cta modal

加微信 / 留手机号 (路径 2)
src/wechat-cta.js 通用 modal
  ├─ Tab 1: 扫码 (二维码 + 复制微信号)
  └─ Tab 2: 留手机号 → POST /api/lead → 飞书 webhook
```

## 四. 埋点

`src/track.js` `YDZX_TRACK.event()` 已挂以下 funnel 关键事件:

- `home_diagnose_click` (Hero CTA 点击)
- `home_tool_click` (学员故事卡点击)
- `home_pricing_click` (定价卡点击)
- `diagnose_complete` (10 题答完)
- `report_view` (报告页加载, 含 `match` + `weak_count`)
- `report_download` (.txt 报告下载)
- `wechat_cta_open` (微信 modal 打开, 含 `channel`)
- `wechat_cta_tab_switch` (扫码↔手机号切换)
- `wechat_cta_phone_submit` (手机号提交成功)

打开 `/leads.html` 可以看到本地埋点 + lead 列表 (浏览器 localStorage 备份).

## 五. 部署后冒烟测试

1. `curl -s https://yuandianzhixue.com/diagnose` → 200 (HTML)
2. `curl -s https://yuandianzhixue.com/report` → 200 (HTML)
3. `curl -sX POST https://yuandianzhixue.com/api/openai-diagnose -H "Content-Type: application/json" -d '{"name":"测试","grade":"初二","subject":"数学","answers":[{"q":"看到难题怎么办","a":"A. 跳过"}]}'` → 200, 返回带 dimensions 的 JSON
4. 浏览器开 `/welcome` → 填名字年级 → 跳 `/diagnose` → 答 10 题 → 自动跳 `/report` → 看到 13 维度报告 + 推荐档 + sticky CTA
5. 点 sticky CTA → 弹出微信 modal, 二维码可见, "留手机号" tab 可填
6. 提交手机号后看飞书群是否收到 lead

## 六. 已知 TODO (后续 P1)

- [ ] 真客服微信二维码替换 SVG 占位
- [ ] FEISHU_WEBHOOK_URL 配置或替换为其他通讯通道
- [ ] articles/ 还有 3 篇占位文章未写正文 (现在 articles.html 标了"连载中" 灰标)
- [ ] 学员故事 (home `#stories`) 现是 fake 内容, 需补真实学员授权头像/视频/前后成绩单
- [ ] /api/openai-diagnose 加 OpenAI 调用日志 (落 KV 或 Logs) 看实际命中率
- [ ] 报告页加 "微信扫码看报告" 二维码 (家长截图给孩子用)

## 七. Vercel 部署配额 (Free tier)

观察到的限制: 100 deploys / day. 高频 commit 会很快打满, 然后 24h 冷却。
建议: 升级 Vercel Pro ($20/月) 解除限制, 或者把多个改动合并到单次 commit 减少触发次数。
