# 原点智学小程序首发版交付说明

## 一句话定位

先判断今晚哪些值得做，再让原小点只辅导关键错因。

## 当前实现

- `miniprogram/`：原生微信小程序骨架，可直接用微信开发者工具打开。
- `pages/home`：今晚学习决策台。
- `pages/entry-detail?scene=today`：诊断入口，保留测评诊断、作业录入、家长雷达、原小点执行四个主流程。
- `pages/upload`：成绩 + 错题描述 + 作业清单生成能力雷达。
- `pages/upload`：作业照片留档 + 手动清单录入，不承诺自动图片识别。
- `pages/profile`：雷达弱点 + 作业三分类。
- `pages/tutor`：原小点只引导高优先级任务和关键错因。
- `pages/profile/legal`：家长授权、隐私、协议、未成年人保护入口。
- `api/mini/session`：小程序会话初始化；配置微信 AppID/AppSecret 后可换 openid。
- `api/mini/tutor-message`：非流式原小点执行对话，适配 `wx.request`。
- `api/mini/priority`：服务端学习优先级兜底接口。

## 最小配置路径

1. 微信公众平台注册小程序，拿到 AppID。
2. 把 `miniprogram/project.config.json` 里的 `appid` 从 `touristappid` 改成真实 AppID。
3. 微信后台配置 request 合法域名：`https://yuandianzhixue.com`。
4. Vercel 环境变量补充：
   - `WECHAT_APP_ID`
   - `WECHAT_APP_SECRET`
   - `MINI_SESSION_SECRET`
   - 已有的 `DEEPSEEK_KEY`
5. 微信开发者工具导入 `miniprogram/`，本地跑通：首页 -> 录入作业 -> 家长雷达 -> 原小点。

## 生产前硬门槛

- 不能把 `student_id` 当授权边界；正式版要用 openid/session 绑定学生。
- 有 AI 对话时，必须补内容安全：文本 `msgSecCheck`，图片上线前再补图片安全检测。
- 完整隐私政策、用户协议、AI 生成内容标识、未成年人保护说明需要替换当前简版文案。
- 不做固定结果、最好、第一、精准攻克等绝对化效果承诺。
- 自动图片识别当前不实现；上线文案只能写“拍照留档 + 手动录入”。

## 低成本上架材料

- 最低成本上架作战表：[MINIAPP-LOW-COST-LAUNCH-WARROOM.md](./MINIAPP-LOW-COST-LAUNCH-WARROOM.md)
- 审核后台复制粘贴材料：[MINIAPP-REVIEW-COPY-PASTE.md](./MINIAPP-REVIEW-COPY-PASTE.md)

## 设计自评

当前设计走“安静的家庭晚间决策台”：米白、墨绿、砖橙，少装饰，多状态卡和底部行动。它不是惊艳型视觉稿，但足够像一个家长每天敢打开的小程序。若后续要拉高视觉上限，最值得让设计模型介入的是雷达页和原小点对话页的动效/插画，不是产品结构。
