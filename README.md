# 原点学伴

原点智学旗下的小程序优先产品。面向家庭晚间学习场景，把作业录入、弱点雷达、作业三分类、原小点思路引导、复习卡和家长周报收成一条轻量闭环。

[![Stack](https://img.shields.io/badge/stack-HTML%20%2B%20MiniProgram%20%2B%20Vercel-18181B?style=flat-square)](#技术路线)
[![Launch](https://img.shields.io/badge/miniapp-review%20ready-0F4F3D?style=flat-square)](./docs/MINIAPP-OPEN-ME-FIRST.md)

## 一句话

原点学伴不是让孩子多做题，而是帮家庭判断今晚哪些作业最值得先做。

## 产品闭环

1. **录入**：家长或孩子手动输入测评成绩、错题描述、作业清单和可用时间。
2. **诊断**：系统生成六维能力雷达，定位概念、计算、审题、迁移、表达、负担等弱点。
3. **取舍**：作业被分成“必须做 / 灵活选择 / 可以跳过”，每项给出理由和预计时间。
4. **执行**：原小点只围绕必须做任务和关键错因给最小提示，不代写、不直接给完整答案。
5. **复盘**：家长看到本周弱点、作业负担、建议话术和下一步重点。

## 当前可用能力

| 模块 | 路径 | 作用 |
|---|---|---|
| 官网主叙事 | `index.html` | 对外讲清小程序优先的家庭晚间学习效率工具 |
| 历史 Web 工具页 | `study-tools.html`, `tools-guide.html` | 历史资产，当前不作为小程序上架主入口 |
| 原小点执行端 | `tutor.html`, `api/mini/tutor-message.js` | 只处理必须做任务和关键错因 |
| 家长雷达 | `parent-radar.html`, `miniprogram/pages/radar` | 弱点雷达、作业三分类、周复盘 |
| 小程序 | `miniprogram/` | 微信上架形态 |
| 小程序 API | `api/mini/` | session、priority、content-check、tutor-message |
| 审核助手 | `scripts/miniapp-*.cjs` | AppID、审核材料、提审前总检查 |

## 技术路线

- **前端**：静态 HTML + 原生 JS；小程序使用微信原生 WXML/WXSS/JS。
- **服务端**：Vercel Edge Functions，当前核心接口在 `api/mini/`。
- **AI**：DeepSeek 服务端调用；缺少 key 时自动降级为本地规则提示。
- **数据**：首版以本地状态 + 服务端无状态计算为主，降低上架和运维成本。
- **学习决策引擎**：成绩、错题文字、作业文字、可用时间 -> 六维雷达 -> 作业价值排序 -> 周复盘。
- **安全边界**：内容安全前置检查、拒绝代写、AI 辅助标识、未成年人保护说明。

## 小程序上架

```bash
npm run miniapp:appid -- wx你的AppID
npm run miniapp:fullcheck
npm run miniapp:review
```

微信后台 request 合法域名只需配置：

```text
https://yuandianzhixue.com
```

详见 [docs/MINIAPP-OPEN-ME-FIRST.md](./docs/MINIAPP-OPEN-ME-FIRST.md)。

## 验证

```bash
npm run miniapp:fullcheck
npm run miniapp:fullcheck -- --remote
npm run test:miniapp-prod
```

## 产品原则

- 不承诺固定学习结果。
- 不做作业代写。
- 不鼓励无限刷题。
- 不把聊天当产品核心。
- 核心价值是学习任务取舍、弱点解释和家长复盘。

## 联系

business@yuandianzhixue.com
