# StudyPal 学伴 · 与原点智学产品体系对接指南
> 现有StudyPal项目(Desktop/claude/studypal)已有基础，本文档指导如何对接

---

## 现有项目状态
- **位置**: Desktop/claude/studypal/
- **技术栈**: Next.js
- **当前功能**: [需确认] — 建议先 `npm run dev` 跑起来看现有功能

## 需要对接/新增的功能（按AI学伴产品设计）

### P0 — 苏格拉底对话引擎
- 接入 `src/prompts/system-prompt-yuanyuan.md` 的8层System Prompt
- 模型路由: 数学→DeepSeek V3.2 / 语文→Qwen Plus
- API路由: `/api/chat` (流式响应)
- 对话存储: conversations表

### P0 — 元元宠物系统
- 6阶段进化: 灵种→灵芽→灵体→灵核→灵魂→灵尊
- 经验值计算: 有效对话+1, 掌握知识点+5
- 前端: 元元形象展示+状态反馈

### P0 — 家长周报
- CRON: 每周日晚8点自动生成
- 推送: 微信服务号模板消息
- 分享卡片: Canvas生成750x1334图片

### P1 — 学习诊断
- 10题自适应测评
- 5维度雷达图
- 结果页+CTA

### P1 — Freemium限额
- 免费版: 5次对话/天
- 付费版: 无限
- 微信支付接入

## 技术架构参考
详见 `knowledge-base/tech-architecture.md`:
- DB Schema (7张表)
- API设计 (3个核心接口)
- 模型调用成本估算
- 8周开发计划

## 下一步
1. `cd claude/studypal && npm run dev` — 看现有功能
2. 对照 `product-ai-studypal.md` 找GAP
3. 按 `tech-architecture.md` 的Week 1-2开始搭建
