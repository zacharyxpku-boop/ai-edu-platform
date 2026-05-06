# 原点智学小程序 v0.9 上架 Runbook

目标：用最低成本把当前小程序送进体验版/审核流程，并保持首版定位安全、清晰、可通过。

## 1. 产品定位

小程序名称：原点智学

一句话简介：

```text
面向家庭晚间学习场景的学习效率工具。家长或学生手动录入测评、错题和作业清单后，系统生成弱点雷达、作业优先级分类、AI 思路引导和复习卡片。
```

审核口径：

- 本版本不含支付。
- 本版本不售卖课程。
- 本版本不提供作业代写。
- 本版本不主打自动图片识别/OCR。
- AI 结果仅作为学习建议，不替代老师、家长或学校判断。

## 2. 上架前命令

在仓库根目录运行：

```powershell
node scripts\test-review-engine.cjs
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1
```

小程序专项检查：

```powershell
npm run miniapp:check
npm run miniapp:review
npm run miniapp:fullcheck
```

拿到真实 AppID 后：

```powershell
npm run miniapp:appid -- wx你的真实AppID
npm run miniapp:fullcheck -- --upload-ready
```

## 3. 微信后台配置

只需要微信公众平台小程序后台，不需要 Apple ID。

必须配置：

- AppID：从微信公众平台复制。
- 开发管理 -> 开发设置 -> 服务器域名 -> request 合法域名：

```text
https://yuandianzhixue.com
```

首版暂不配置：

- 支付。
- uploadFile 合法域名。
- downloadFile 合法域名。
- 订阅消息。
- 复杂客服/社交能力。

后续生产化再配置：

- `WECHAT_APP_ID`
- `WECHAT_APP_SECRET`
- `MINI_SESSION_SECRET`
- 模型服务 API key
- Supabase 或其他云数据库环境变量

## 4. 微信开发者工具导入

导入目录：

```text
C:\Users\86136\Desktop\claude\ai-edu-platform\miniprogram
```

真机预览必须走一遍：

1. 首页：确认今日任务中心和 demo 路径可见。
2. 上传/录入：手动输入一组今晚作业。
3. 雷达：查看弱点和作业三分类。
4. Tutor：点击必须做任务，确认只给思路引导，不直接代写。
5. Review：确认生成复习卡、测验、修复路径。
6. Profile：确认家长周报、内测证据、生产 checklist 可见。

建议审核测试输入：

```text
数学方程基础题 8 道
应用题 4 道，写完整过程
整理今天错题并说出错因
英语单词抄写 3 遍
```

## 5. 审核材料

生成材料：

```powershell
npm run miniapp:review
```

审核路径建议：

```text
今日 -> 录入今晚作业 -> 生成家长雷达 -> 点击必须做任务 -> 进入原小点执行端 -> 生成复习卡 -> 查看家长周报
```

版本描述：

```text
本版本为家庭学习效率工具。用户可手动录入测评成绩、错题描述和作业清单，系统生成能力雷达、作业优先级分类，并提供 AI 辅助的思路引导和复习卡片。本版本不含支付、不含课程售卖、不含自动图片识别、不提供作业代写服务。AI 内容仅作为学习建议，不替代老师、学校或家长判断。
```

如被问到教育资质：

```text
本版本定位为学习效率和任务整理工具，不提供学科培训课程、教师授课、付费课程交易或考试结果承诺。如后续进入教育培训类目，将按平台要求补充主体资质。
```

如被问到隐私：

```text
用户主动填写的学习信息仅用于生成学习建议、弱点雷达和作业优先级分类。联系信息仅用于用户主动提交后的内测回访。未成年人使用前应获得家长或监护人同意。
```

## 6. 截图清单

上传体验版前保留以下截图：

- 首页今日任务中心。
- 作业录入页。
- 雷达和作业三分类页。
- 原小点 tutor 思路引导页。
- 复习卡/测验页。
- 家长周报页。
- 隐私/用户协议页。

截图用于三件事：

- 审核材料补充。
- 内测家庭引导。
- 投资人演示备份。

## 7. 不要在首版新增

首版上架前不要新增：

- 支付闭环。
- 真好友排行榜。
- 自动 OCR 作为主卖点。
- 视频/PPT 真实解析。
- 大规模题库。
- 保证提分文案。
- “全国第一、行业第一、最强、最好”等绝对化表达。

这些都会增加审核、合规、技术和产品解释成本。

## 8. 上架状态判断

当前可做：

- 本地验证。
- 微信开发者工具预览。
- 体验版上传前材料准备。
- 10 家庭内测招募。
- 投资人 demo。

当前真实阻塞：

- 没有真实 AppID 时不能上传体验版。
- 没有后台域名和 env key 时不能宣称云同步生产可用。
- 没有真实家庭数据时不能宣称提分效果。

状态：

```text
Code/docs closeout: READY
Miniapp upload: BLOCKED until real AppID
Pilot: READY after test families are recruited
```
