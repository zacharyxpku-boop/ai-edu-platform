# 原点学伴 / 原点智学产品索引

本仓库当前主产品已经收束为微信小程序优先形态。旧版 Web AI 私教、题库站、NCDM PoC、提分实验等材料只作为历史资产保留，不再作为当前上架和对外叙事入口。

## 一句话

原点学伴是原点智学旗下的家庭晚间学习效率工具：

```text
作业/测评录入 -> 弱点雷达 -> 作业三分类 -> 原小点思路引导 -> 复习卡 -> 家长周报 -> 内测证据
```

它不定位为课程平台，不定位为作业代写工具，也不承诺固定提分结果。首版目标是让家庭更清楚今晚应该先做什么，让孩子把关键错因沉淀下来。

## 当前对外名称

- 母品牌 / 公司品牌：原点智学
- 小程序 / App 产品名：原点学伴
- 孩子端引导人格：原小点

## 当前小程序填写建议

```text
小程序名称：原点学伴
小程序简称：原点学伴
服务类目：工具 -> 信息查询
小程序介绍：面向家庭晚间学习场景的学习效率工具，支持作业录入、弱点雷达、作业优先级分类、思路引导与复习卡。
```

如审核要求说明类目：

```text
本小程序主要用于用户主动录入学习任务、作业和错题后，查询并生成学习任务整理、弱点雷达、作业优先级和复习卡片等信息服务；不提供课程售卖、教师授课、学科培训或作业代写服务。
```

## 当前主链路

### 1. 家长/学生录入

入口：小程序 `upload` / `diagnosis`

用户手动输入：

- 今晚作业
- 错题描述
- 测评/考试结果
- 可用学习时间

首版不主打自动 OCR，不把图片识别作为审核卖点。

### 2. 雷达弱点

入口：小程序 `radar`

输出：

- 当前弱点
- 能力雷达
- 作业风险判断
- 家长可理解的说明

### 3. 作业三分类

输出：

- 必须做：高价值、高风险、命中当前弱点
- 可以跳过：低价值、重复性强、时间紧时可降优先级
- 灵活选择：按剩余时间和精力安排

核心理念：

```text
不是让孩子做更多，而是让孩子先做最值得做的。
```

### 4. 原小点思路引导

入口：小程序 `tutor`

原则：

- 只辅导“必须做”和“关键错因”
- 先问条件、第一步、错因
- 不直接给代写式答案
- 结束时生成可给家长看的思考证据

### 5. 复习卡与长期记忆

入口：小程序 `review`

能力：

- 错因卡
- 第一步卡
- 概念卡
- 修复卡
- FSRS-like 间隔复习
- 轻量游戏化奖励

当前是本地/规则优先版本；真实参数优化需要长期使用数据。

### 6. 家长周报与内测证据

入口：小程序 `profile`

输出：

- 家长周报
- 思考证据
- 同步准备度
- 内测证据记录
- 数据飞轮状态
- 上架 checklist

## 当前核心文件

```text
miniprogram/
  app.json
  pages/home/
  pages/upload/
  pages/diagnosis/
  pages/radar/
  pages/tutor/
  pages/review/
  pages/tools/
  pages/profile/
  pages/legal/
  utils/api.js
  utils/storage.js
  utils/review-cards.js
  utils/learning-modules.js

api/mini/
  priority.js
  tutor-message.js
  content-engine.js
  content-check.js
  session.js
  sync.js
  weekly.js
  feedback.js

docs/
  V0.9-SHIP-INDEX.md
  MINIAPP-V0.9-LAUNCH-RUNBOOK.md
  10-FAMILY-PILOT-RUNBOOK.md
  INVESTOR-DEMO-SCRIPT-V0.9.md
  MINIAPP-REVIEW-COPY-PASTE.md

scripts/
  verify.ps1
  miniapp-launch-assistant.cjs
  miniapp-fullcheck.cjs
  miniapp-review-pack.cjs
  test-review-engine.cjs
```

## 当前验证命令

仓库总验证：

```powershell
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1
```

小程序专项：

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

## 当前 Go / No-Go

Go：

- 代码验证通过
- 小程序页面完整
- 审核文案已收口
- 敏感承诺词检查通过
- 10 家庭内测 SOP 已准备

No-Go：

- 没有真实 AppID 就上传
- 把产品说成 AI 私教或培训课
- 承诺提分
- 主打自动 OCR
- 上架前临时加入支付、课程、真社交或复杂深度合成功能

## 当前真实阻塞

- 真实微信 AppID
- 微信后台 request 合法域名
- 真机预览最后确认
- 模型 API key / 云同步生产 env
- 真实家庭长期使用数据

## 历史资产处理

仓库中仍保留旧版 Web 页面和实验材料，例如：

- `tutor.html`
- `question-bank.html`
- `mentor.html`
- `mastery-loop.html`
- `platform.html`
- 早期 PoC / 高考题库 / AI 私教文档

这些不是当前小程序上架入口。后续如果继续清理，应按“保留历史、降低曝光、避免外部入口误导”的原则分批处理。
