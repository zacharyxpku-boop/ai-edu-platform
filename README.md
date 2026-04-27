# 原点 AI 学堂 · K12 高考 AI 提分平台

[![Release](https://img.shields.io/badge/release-v1.1.2--test--coverage--fix-15803D?style=flat-square)](https://github.com/zacharyxpku-boop/ai-edu-platform/releases/tag/v1.1.2-test-coverage-and-fix)
[![Subjects](https://img.shields.io/badge/subjects-8%2F9%20live-2563EB?style=flat-square)](./subjects/)
[![Textbooks](https://img.shields.io/badge/textbooks-56%20%C2%B7%20%E4%BA%BA%E6%95%99%2F%E7%BB%9F%E7%BC%96-059669?style=flat-square)](./paths.html)
[![Stack](https://img.shields.io/badge/stack-pure%20HTML%20%2B%20Vercel-18181B?style=flat-square)](#-stack)
[![Status](https://img.shields.io/badge/status-shipping-DC2626?style=flat-square)](./docs/KA-LOCALIZE-MILESTONE-v1.md)

> 把可汗学院（Khan Academy）的认人 → 路径 → 反馈 → 仪式感闭环移植到中国 K12 高考升学场景。
> 56 本人教 / 统编教材按学段 → 学科 → 年级 → 教材 → 章节五级铺开，每章可练可错可冲关，学生 + 家长 + AI 私教三方在一处。

---

## 30 秒读懂

- **学生侧**：8 学科枢纽页，每科带 mastery 圆环、智能 Up Next、3 套时段化打法、5 题考前冲关、错题本接 FSRS 间隔重复
- **家长侧**：每个学科页底「💌 给家长看」状态机 + 一键复制微信简报，反虎妈式建议直接写在 UI 里
- **AI 私教**：DeepSeek 驱动的 Khanmigo 化对话，三栏面板替代纯聊天，章节绑定，苏格拉底式追问
- **数据**：纯 localStorage 单一信源（8 个 key），零迁移即跨页打通
- **栈**：纯 HTML + Vercel edge functions + 后端 `/api/ai-proxy` 代理 DeepSeek

阶段入口（按看的人不同选一个）：

- **先看打了什么仗** → [v1.0 → v1.1 阶段演进](./docs/V1.0-TO-V1.1-DIFF.md) · 6 维对照表 + 5/4 demo checklist
- **先看交付了什么** → [KA 本地化里程碑 v1](./docs/KA-LOCALIZE-MILESTONE-v1.md) · 7 模块清单 + 数据契约
- **想知道现在赌什么** → [实验赌桌 v1.1](./docs/EXPERIMENT-WEEK-v1.1.md) · 6 EXP 假设/止损/数据窗
- **拍版怎么取数** → [Console 极简观察](./docs/OBSERVABILITY-MINIMAL.md) · 5 段 snippet 复制即跑

---

## 核心能力清单（v1.0-ka-wave）

| 能力 | 文件 / 工具 | KA 原型映射 |
|---|---|---|
| 8 学科枢纽 | `subjects/{math,physics,chemistry,chinese,...}.html` | Course pages |
| 章节 mastery 地图 | `paths.html` | Mastery map |
| 个性化 Up Next | `src/today-recos.js` + `src/subject-hub.js` | "Up next for you" |
| 5 题考前冲关 | `errors.html` Mastery Challenges 中文化 | Mastery challenges |
| 冲关战利品墙 | `progress.html` | Achievements |
| 家长视图 | `subject-hub.js` renderParentSummary | Parent dashboard |
| 连续学习天数 | `src/streak-bar.js` | Daily streak |
| AI 私教三栏面板 | `tutor.html` | Khanmigo |
| 时段化打法卡 | `subject-hub.js` renderPlaybooks | KA suggested practice |

---

## 快速开始

```bash
git clone https://github.com/zacharyxpku-boop/ai-edu-platform.git
cd ai-edu-platform
# 任意静态服务器即可（vercel dev 推荐, 自动起 /api/* 代理）
vercel dev
# 或
npx http-server -p 3000
```

打开 `http://localhost:3000`，先 30 秒注册（welcome 页填昵称 + 年级），即可进入个性化 K12 全学段视图。

---

## 工程结构

```
.
├── index.html, paths.html, quiz.html, errors.html, progress.html
├── subjects/         # 8 学科枢纽页(4 静态 + 1 registry 覆盖 4 学科)
├── tools/            # 工具页(textbook-browser / feynman / exam-diagnosis / ...)
├── src/              # 共享 JS 引擎
│   ├── subject-hub.js     # 学科枢纽渲染引擎(stage / Up Next / Playbooks / Parent View)
│   ├── today-recos.js     # 跨页 Up Next banner
│   ├── streak-bar.js      # 连续学习天数组件
│   ├── learning-store.js  # 错题 / outcome 单一存储层
│   ├── gamification.js    # XP / 徽章 / streak 数据
│   └── share-kit.js       # html2canvas 分享卡生成
├── api/              # Vercel edge functions(DeepSeek 代理 + Supabase 读写)
├── data/extracted/   # 56 本教材 OCR manifest + 章节正文
├── db/               # Supabase migrations
└── docs/             # 设计 / 决策 / 战略文档
```

---

## 数据流

学生本地行为 →（写）`localStorage` 8 个 key → 跨页消费方读取并渲染 mastery / 推荐 / 家长视图。
教材 manifest 固化在 `data/extracted/manifest.json`（CDN 直连 raw GitHub）。
AI 调用全部走 `/api/ai-proxy`，前端不暴露 DeepSeek key。

详见 `docs/KA-LOCALIZE-MILESTONE-v1.md` 第 3 节「数据契约」。

---

## 演示动线（demo day 用）

1. `/welcome` 30 秒注册（grade=high_2）
2. 首页看到 Up Next + What's New + 9 学科 grid
3. 进数学 → 默认锁高中 tab → 看到圆环 + 3 套打法 + 错题切片
4. quiz 答对 3 题 → 顶部连对 ✨3
5. errors 攒满 5 道同章节 → 5 题冲关 → 全对解锁徽章
6. 回 progress 看战利品墙 → 复制家长简报粘贴微信群

---

## 技术栈 <a name="-stack"></a>

- 前端：纯 HTML + 内联 CSS + 原生 JS，零打包依赖（部分页面 ES module）
- 后端：Vercel edge functions（Node.js）+ Supabase Postgres + DeepSeek API
- AI：DeepSeek `deepseek-chat`（`api.deepseek.com/v1/chat/completions`）
- 部署：Vercel（cleanUrls=true, trailingSlash=false）
- 教材源：[ChinaTextbook](https://github.com/TapXWorld/ChinaTextbook) 10.3 万 star 仓库 + 自研 OCR pipeline

---

## License & 联系

公众号「原点AI学堂」 · business@yuandianzhixue.com

让孩子站在 AI 的肩膀上学习、创造、看见未来。
