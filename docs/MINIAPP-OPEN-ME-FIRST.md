# 先打开这个：小程序最省事上架

你不用管 Apple ID。微信小程序只需要微信公众平台的 `AppID`。

## 你只做 5 件事

1. 打开微信公众平台，进入小程序后台，复制 `AppID`。
2. 在本项目运行：

```bash
npm run miniapp:appid -- wx你的AppID
```

3. 微信后台 -> 开发管理 -> 开发设置 -> 服务器域名，把 request 合法域名填成：

```text
https://yuandianzhixue.com
```

4. 微信开发者工具导入：

```text
C:\Users\86136\Desktop\claude\ai-edu-platform\miniprogram
```

5. 上传体验版，然后提交审核。审核材料直接复制：

```text
docs/MINIAPP-REVIEW-COPY-PASTE.md
```

## 先别做的事

- 先别配支付。
- 先别配上传域名。
- 先别做自动图片识别。
- 先别碰 Apple 开发者账号。
- 先别申请复杂教育资质，首版按学习效率工具验证。

## 提审前一键预检

```bash
npm run miniapp:check
```

连生产接口也一起检查：

```bash
npm run miniapp:check -- --remote
```

## AppSecret 要不要

首版可以不要。代码会用本地体验模式跑通测评、作业三分类、雷达和原小点陪练。

以后要做真实微信登录、openid、家长绑定，再配置：

- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `MINI_SESSION_SECRET`
