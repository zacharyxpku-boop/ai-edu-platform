# 实施验收清单 · 2026-04-28 prompt 体系 v2 全天落地

**版本**：v0.9 草稿（待并行 agent 完成后升 v1.0）
**受众**：团队成员（产品 / 工程 / 教研 / 运营）
**用途**：让每个角色知道自己今天该 review 什么、该测什么。今天 94 个 commit 串起来一份验收图。
**对应设计源**：
- `docs/PROMPT-SYSTEM-V2-MASTER.md` v2.0（5 部分体系单一权威来源）
- `docs/CHINESE-FAMILY-AI-MANAGER-V1.md` v1.0（顶层定位三角形）

> AI 角色今天正式定名「**原小点**」（学生可叫小点），项目「**原点智学**」。

---

## 一、全天 commit 时间线（>=20 条核心 commit）

按时间倒序，挑出与 prompt 体系 v2 / B 模式闭环 / UI v2 / observability 主线相关的 commit。完整 94 条 commit 见 `git log --since='2026-04-28 00:00'`。

```
14:37  4516b7e  feat(ui)     tutor.html 6 处改动对齐 PROMPT-SYSTEM-V2-MASTER §5
                └ 影响：tutor.html（开场策略 / quick chip / 节奏点 / 错题→掌握度 / 呼叫学长降权 / 删「你还记得我吗」）
                └ 验收：打开 tutor.html，对照 §5 表格 6 条逐项点过

14:35  5511f86  v2 token     残漏清理 · 5 处硬编码 amber → 墨绿/砖红
                └ 影响：跨页 amber/橙色硬编码替换
                └ 验收：grep 全站 #f59e0b 应为 0

14:25  341a175  v2 token     收尾 · 商业 5 页（platform/assistant/articles/about/membership）
                └ 影响：5 个商业页接 v2 视觉 token
                └ 验收：5 页打开看主色统一墨绿+砖红

14:21  69798f5  feat(prompt-v3 主体精修)  补 4 段空白对齐 PROMPT-SYSTEM-V2-MASTER
                └ 影响：api/tutor-chat.js buildSystemPromptV3
                └ 验收：curl /api/tutor-chat 看 system prompt 含「原小点 / 四件事循环 / 错题归因 6 类 / 节奏感」

14:19  c791e08  v2 token     传播 · funnel 4 页（welcome/quiz/errors/methodology）
                └ 影响：漏斗 4 页接 v2 视觉
                └ 验收：4 页色彩与 home v2 一致

14:13  ebe6dc6  feat(prompt-system-v2 + brand)  单一权威来源落档 + AI 改名「原小点」
                └ 影响：docs/PROMPT-SYSTEM-V2-MASTER.md + 全站「清北学姐」→「原小点」
                └ 验收：grep 全站「原小点」应 ≥ 10 处；旧 PROMPT-V2-DRAFT 标记 deprecated

14:12  5a014ec  v2 token     传播 · 4 nav 落点统一接 home v2
14:03  88c51e1  home v2      视觉精修 · 编辑部 × 学院派混血 · 米白 + 深墨绿 + 宋黑混排
                └ 验收：home 打开第一眼无紫蓝渐变、无 rounded-3xl、字体宋黑混排

13:46  071463e  refactor(tutor)  删左栏学科树 — 产品形态归正为学习管家不是学科目录
                └ 影响：tutor.html 左栏
                └ 验收：左栏不再是 9 学科树，是「最近会话 / 错题图谱入口」

13:32  0295aed  3 次级页统一接 spec · 4-item nav · 去 emoji
13:21  7321eb8  assistant.html  深蓝 navy 主题 → 浅底 + 单灰阶 · 4-item nav · 去 emoji
13:20  661e86e  fix(cdn)     max-age=0 真覆盖 default — 浏览器本地不再 cache HTML 4h
                └ 验收：DevTools Network 看 HTML 响应头 max-age=0

13:15  0119ce4  fix(cdn)     vercel.json source 正则改 path-to-regexp 合法
13:13  c475e48  platform.html  7-item nav → 4-item · 主色 amber→primary
13:04  9b6f1d2  study-tools.html  4 维四色 → 单灰阶 + 主色橙 accent
13:03  204737a  fix(cdn-cache)  HTML cache TTL 4h → 60s
12:55  bd40db9  progress.html  战利品墙 9 学科色阶 → 单灰阶
12:49  73f2180  docs(P1-5)   SESSION-LOG v1.2 + Playbook B 模式 5 分钟演示段
                └ 影响：docs/SESSION-LOG-2026-04-28.md / DEMO-DAY-5.4-PLAYBOOK.md
                └ 验收：Playbook 含 B 模式 5 分钟现场剧本

12:44  8ab3610  feat(P1-4)   同型连错 3 次自动呼叫学长 + tutor 收到回复气泡
                └ 影响：api/escalate.js 自动触发 + tutor.html 气泡
                └ 验收：tutor 模拟连错 3 次同型，escalation 自动落表

12:40  dbcea17  feat(quiz)   每日一题视觉对齐 spec
12:38  c10f2d0  feat(P1-3)   学长接班看板 /api/mentor-queue + mentor.html — B 模式真活
                └ 影响：api/mentor-queue.js + mentor.html
                └ 验收：访问 /mentor.html 应看到 escalations 队列

12:33  592e650  feat(errors) 错题本视觉对齐 spec · CSS 重写
12:33  4bd9231  feat(P1-2)   /api/student-dossier 学情档案 + escalation.context 自动塞 dossier
                └ 影响：api/student-dossier.js
                └ 验收：curl /api/student-dossier?student_id=X 返回 6 字段画像

12:29  1419dfc  feat(P1-1)   错题图谱端点 + parent-radar 自动归类视图 — 64 misconception
                └ 影响：api/error-graph.js + parent-radar.html
                └ 验收：parent-radar 顶部看到错题归因画像

12:23  22fe60d  feat(P0-3)   妈妈晨间简报 /api/parent-brief + parent-radar「今日给妈妈的话」
                └ 影响：api/parent-brief.js + parent-radar.html
                └ 验收：curl /api/parent-brief 返回 3 行简报

12:22  0c0c8a0  feat(paths)  重写匹配 spec 设计 · 4 阶灰度替代彩色 chip
12:18  060459b  chore(brand) 「清北哥哥姐姐」全替换为「学长学姐」— 去尬感
                └ 验收：grep 全站「清北哥哥姐姐」应为 0

12:16  d281811  feat(welcome)  重写匹配新首页设计语言 · 诊断 step 1/3
12:15  0c98e2c  feat(P0-2)   escalations 表 + /api/escalate + tutor「呼叫清北」按钮 — B 模式真活
                └ 影响：supabase/escalations 表 + api/escalate.js + tutor.html
                └ 验收：tutor 点击按钮，escalations 表新增一行

12:12  3c5bc8f  feat(home)   首页改造按 spec 重写 · Linear/Vercel/Anthropic 克制
12:09  e191abb  feat(v3+recall)  「下课讲一讲」苏格拉底+费曼学习法
                └ 影响：api/tutor-chat.js v3 prompt
                └ 验收：tutor 输入「我今天上课老师讲了 XX」，AI 反问而非直接讲

11:40  3d5c7a5  feat(prompt-v3)  家庭学习运营官版 — 从「数学老师」到「学习管家」核心 pivot
                └ 影响：api/tutor-chat.js buildSystemPromptV3 全量重写（约 305 行）
                └ 验收：env PROMPT_VERSION=v3 + curl chat 看 system 含「四件事循环 / 6 归因」

10:58  82edfa8  fix(tutor)   input-bar 从 absolute 改 sticky — welcome 长内容不再被遮

—— 凌晨场（v1.1 observability 主线）————————————————————

05:40  ff3228e  docs(README)  badge 升 v1.1.2-test-coverage-and-fix
05:08  a31795e  docs         同步 npm test 五段 524 assertion
04:39  057918c  fix+test(today-recos)  readN schema drift bug + 5 case 单测
04:11  3611f19  test(streak-bar)  scripts/test-streak-bar.cjs · 5 case
03:41  2dfec9d  test(track)  scripts/test-track.cjs · sandbox
03:13  ff92742  docs(index)  docs/README 加 v1.1 实验赌桌 + 自动化测试
02:46  bf6b632  docs(wind-down)  全程总览 · 3 tag 阶段 + 5 设计原则
02:42  4c729e8  docs(observability)  npm test 跑 2 件事 + CI 守门
02:39  1135df2  test         scripts/check-static-links.cjs 静态链接 404 lint
02:35  dfdfd81  ci           GitHub Action 跑 npm test
02:31  2942a26  docs(README) badge 升 v1.1.1-observability-hardened
02:28  0dddd90  docs(SESSION-LOG)  Round 3 深夜场 — observability 9 commit
02:25  2332b85  docs(observability)  三跳漏斗 snippet · home → hub PV → action
02:21  9474727  feat(track)  track.js 加载即自动 page_view + 11 主页/hub 全 wire
02:16  7136e29  feat(track)  src/track.js 抽公共 + index 9 学科 grid 全埋点
02:11  f10e4a9  feat(track)  学科 hub 6 高频按钮 trackEvent 全接
02:06  d09d0ab  feat(track)  trackEvent + parent_card 真点击埋点
01:42  c5cf331  feat(P1-D)   tutor 顶部加 4 模式切换 chip
01:37  15e7a82  feat(P0-C)   初一数学全册 10 章 42 KP 铺满
01:33  da2814a  feat(hub)    学科页错题切片 加 "🤖 讲讲" 直跳 tutor 带题目上下文
01:31  a2d8de8  feat(P0-B)   parent-radar 加最近对话历史
01:27  77218f4  feat(P0-A)   mastery-loop 答错弹 mini-tutor 浮窗
00:46  86f83fd  exp(EXP-1 sunset)  英语 manifest blocker · OCR 未就位 · 撤回不 fake
00:33  96bcd24  docs         EXPERIMENT-WEEK-v1.1 6 候选改进 hypothesis 表
00:29  cfab40a  feat(home)   首页 hero 下加 横滑 What's New 带
```

---

## 二、5 模块实施状态终态表

对照 `PROMPT-SYSTEM-V2-MASTER.md §状态对照表`，每模块的最终落地 + 验收 + 待办。

### 模块 1 · §0 元规则（Meta Rules）

- **落地位置**：`api/tutor-chat.js` `buildSystemPromptV3` 第一段（约前 60 行）
- **设计来源**：`PROMPT-SYSTEM-V2-MASTER.md §0`
- **实施 commit**：3d5c7a5（11:40 v3 主体）+ 69798f5（14:21 4 段补全）+ ebe6dc6（14:13 单一权威来源 + 改名）
- **状态**：完成
- **验收方式**：
  ```bash
  curl -X POST $URL/api/tutor-chat \
    -H 'content-type: application/json' \
    -d '{"messages":[{"role":"user","content":"测试"}],"debug":true}'
  # 看返回 system_prompt 字段，应包含 16 条铁律：立场/语言风格/数据使用/Tier 一致性/节奏控制
  ```
- **待办**：无（v2 体系完整覆盖）

### 模块 2 · §1 原小点本体（学生主对话 prompt）

- **落地位置**：`api/tutor-chat.js` `buildSystemPromptV3` 主体（约 60-305 行）
- **设计来源**：`PROMPT-SYSTEM-V2-MASTER.md §1`（十节：身份 / Tier / 注入数据 / 开场 / 四件事循环 / 6 归因 / 记忆方式 / 节奏感 / 8 禁忌 / 输出格式）
- **实施 commit**：3d5c7a5（核心 pivot）+ e191abb（苏格拉底/费曼）+ 69798f5（4 段补全）+ ebe6dc6（改名「原小点」）
- **状态**：完成
- **验收方式**：
  ```bash
  # 1) PROMPT_VERSION=v3 启用
  PROMPT_VERSION=v3 npm run dev
  # 2) tutor.html 实测开场，确认开场公式：[称呼]+[回顾上次卡点]+[今天提议]+[预计时长]+[开始确认]
  # 3) 模拟错题，AI 必须给 6 类归因之一（不允许「不仔细」）
  # 4) 模拟疲态信号「不想做了」，AI 必须先停学习再问状态
  ```
- **待办**：跑 baseline eval（运营角色）

### 模块 3 · §2 家长视角周报

- **落地位置**：`api/parent-brief.js`（晨间简报）+ parent-radar.html「今日给妈妈的话」
- **设计来源**：`PROMPT-SYSTEM-V2-MASTER.md §2`（5 段固定结构）
- **实施 commit**：22fe60d（P0-3 妈妈晨间简报 12:23）+ a2d8de8（00:31 加最近对话历史）+ 1419dfc（12:29 错题图谱给家长用）
- **状态**：deterministic 版完成；LLM 5 段结构待加 `?enrich=llm`
- **验收方式**：
  ```bash
  curl '$URL/api/parent-brief?student_id=demo'
  # 当前返回：3 行 deterministic 简报（昨晚练量 + 今日复习 + 情绪提示）
  # 期望（待办）：?enrich=llm=true 返回 5 段结构（一句话总结 / 进步看板 / 错题归因画像 / 话术建议 / 下周重点）
  ```
- **待办**：parent-brief.js 加 `?enrich=llm` 模式 → 调 DeepSeek 生成 5 段（建议明天）

### 模块 4 · §3 内容隔离规则（A/B/C 三类）

- **落地位置**：产品级规则（PROMPT-SYSTEM-V2-MASTER §3）+ `api/extract-dialogue-signals.js`（已有，只暴露 4 字段 signals）+ parent-radar 不显示对话原文
- **设计来源**：`PROMPT-SYSTEM-V2-MASTER.md §3`
- **实施 commit**：a2d8de8（parent-radar 「最近对话历史」给摘要不给原文）+ 1419dfc（错题图谱归因）
- **状态**：部分隔离（A 类 + B 类已隔离；C 类危机上报路径未完整）
- **验收方式**：
  - 打开 parent-radar.html，确认看不到学生对话原文（B 类禁出）
  - 看到的是数字 / 归因 / 进度（A 类按家长视角呈现）
- **待办**：
  1. C 类危机信号上报通道（T6 触发时多端 push 给家长 + 平台人工）
  2. 周报清洗流程 4 步（A 抽 / B 弃 / C 判断 / D 生成）显式化为 parent-brief.js 注释或独立函数

### 模块 5 · §4 分诊触发器 T1-T7

- **落地位置**：`api/tutor-chat.js` v3 prompt（已含 3 档分诊）+ `api/escalate.js`（已落表）+ 8ab3610（同型连错 3 次自动触发）
- **设计来源**：`PROMPT-SYSTEM-V2-MASTER.md §4`（T1-T7 + 转交工单格式）
- **实施 commit**：0c98e2c（P0-2 escalations 表 + 「呼叫清北」按钮 12:15）+ c10f2d0（P1-3 学长接班看板 12:38）+ 8ab3610（P1-4 同型连错 3 次自动 12:44）+ 4bd9231（P1-2 escalation.context 自动塞 dossier 12:33）
- **状态**：T1-T2-T5（方法论失败 / 概念追问 / 情绪挫败）有路径；T3-T4-T6-T7 触发器代码层面待精化
- **验收方式**：
  ```bash
  # 1) tutor.html 模拟 3 次同型错题 → escalation 自动落表
  # 2) 访问 /mentor.html → 看到 escalation 队列
  # 3) 学长接管 → tutor 端学生侧收到回复气泡
  # SQL 查
  select * from escalations order by created_at desc limit 10;
  ```
- **待办**：
  1. 转交工单结构化（T1-T7 自动判断 kind + 生成结构化工单）
  2. 学长侧 AI 草稿（学长收到工单后系统给一份 v3 prompt 生成的回复草稿，5.5 内测期）

### 附加 · §5 UI Mockup 6 处改动

- **落地位置**：`tutor.html`
- **设计来源**：`PROMPT-SYSTEM-V2-MASTER.md §5`
- **实施 commit**：4516b7e（14:37 6 处改动对齐 §5）+ 071463e（13:46 删左栏学科树）+ 12:18 「清北哥哥姐姐」全替换
- **状态**：完成
- **验收方式**：打开 tutor.html，对照 §5 表格 6 条逐项点过：
  - ❶ 开场无信息 → AI 主动出牌 + 三个情境性按钮
  - ❷ 错题次数 → 改成「修复进度 / 掌握度变化」
  - ❸ 家长视角大黑按钮 → 移到右上角小字
  - ❹ 呼叫学长强按钮 → 虚线小框 + 分诊语言
  - ❺ 「你还记得我吗」 → 已删
  - ❻ 节奏感 → 顶部「今日 ●●○○○ · 还有 12 分钟」

---

## 三、给每个团队角色的行动清单

### 产品角色（Zack 自己）

今天必须 review 的 5 件事：

1. **`PROMPT-SYSTEM-V2-MASTER.md` v2.0 整体逻辑闭环** — 验收：5 部分能否串成一条因果链，元规则 → 学生本体 → 家长周报 → 内容隔离 → 分诊触发器，无逻辑空隙
2. **tutor.html 6 处改动是否真的「降低 AI 味」** — 验收：自己进 tutor 跑 3 分钟，能不能感到「学习管家」而不是「客服机器人」
3. **parent-brief 内容是否真的「不卖焦虑」** — 验收：把 3 行简报念给一个不懂行的人听，问「你听完想催孩子还是想夸孩子」
4. **escalation B 模式闭环是否能演** — 验收：tutor 触发 → mentor 接 → tutor 收回复，3 步全打通跑一遍
5. **5.4 demo Playbook 是否覆盖最坏情况** — 验收：DEEPSEEK_KEY 失效 / mentor 30 秒没刷新 / AI 草稿失败，3 种情况都有应急话术

### 教研角色

内容侧今天没动代码，但下面这些**今天的设计成果**需要教研补底层素材：

1. **错题归因 6 类的真题样本库** — PROMPT-SYSTEM-V2-MASTER.md §1 六、定义了 6 类（概念性 / 方法性 / 审题性 / 计算性 / 步骤跳跃 / 熟练度）。教研需要：每类挑 5 道初一数学真题 + 标注信号 + 标注后续动作，结构化成 JSON 注入 prompt
2. **学科教研内核（数学先行）** — 落地优先级 6（5.5 内测期）：题型库 + 归因模板结构化为 prompt 可注入 JSON
3. **64 misconception 列表的中文初一适配** — 1419dfc 落了端点，但 64 类 misconception 是 Khanmigo 的英文标签，需教研侧本土化映射

### 运营角色（5.4 demo 前）

1. **跑 SEED-DEMO-GUIDE.md 5 步** — 把 demo 账号灌活
   ```bash
   # 验收：demo 账号登录后 parent-radar 至少 7 天数据 + 错题图谱有 ≥ 20 个错题
   ```
2. **录 1-2 个真孩子 30 分钟试用** — 视频 + 文字记录
   - 卡点 / 困惑 / 惊喜 / 厌烦点都标注时间戳
   - 重点观察：开场 30 秒孩子是不是被吸住 / 错题归因话术孩子是否听懂
3. **跑 PROMPT_VERSION=v3 baseline eval**
   ```bash
   # 准备 20 道初一数学错题样本，丢给 v3 prompt
   # 评分维度：归因正确率 / 不直接给答案率 / 节奏感（开场+收尾完整）
   # 对比 v2 baseline，目标：归因正确率 +20%
   ```
4. **5.4 Playbook 7 分钟版彩排** — DEMO-DAY-5.4-PLAYBOOK.md
5. **EXP-2/3/4 数据 W1 checklist** — EXPERIMENT-WEEK-v1.1.md

### 工程角色（明天可继续 P2-P3 长尾）

1. **parent-brief.js 加 `?enrich=llm` 模式** — 5 段 LLM 周报（模块 3 待办）
2. **escalate.js 转交工单结构化** — T1-T7 自动判断 kind + 工单格式落地（模块 5 待办）
3. **学长侧 AI 草稿** — mentor.html 学长收到工单后系统给一份 v3 prompt 生成的回复草稿（5.5）
4. **C 类危机信号通道** — T6 触发时多端 push（模块 4 待办）
5. **lesson video 内容线**（P2）
6. **安全护栏 / Stripe 订阅**（P3）

---

## 四、风险红线（5.4 demo 翻车防御）

5 条今天 ship 的能力中可能现场翻车的风险点 + 应急话术。

| # | 风险点 | 触发概率 | 应急动作 | 演示话术 |
|---|---|---|---|---|
| 1 | DEEPSEEK_API_KEY 失效或限流 → tutor 回 503 | 中 | 切 fallback 到 deterministic 模板回复（已有 v3 fallback） | 「我们走 fallback 模式给你看保守版本响应，这是 ToB 必做的降级保障」 |
| 2 | mentor.html 30 秒没刷新 escalations | 中 | 手动 F5 / 切 tab 再切回 | 「学长侧轮询 30 秒一次，正式版会上 SSE 推送」 |
| 3 | AI 草稿生成失败 / 超时 | 高 | 学长直接手写（流程不依赖草稿） | 「学长 30 秒读完档案，手写比 AI 草稿更准——这就是为什么不是纯 AI」 |
| 4 | 错题归因落 6 类失败 → AI 说「不仔细」 | 低 | 现场跳过这一题，挑预跑过的样题 | 不演示这一道；预先准备 3 道 100% 通过的归因样题 |
| 5 | tutor.html 6 处改动在 mobile 端塌掉 | 中 | demo 限定桌面浏览器，mobile 不演 | 「桌面优先验证产品逻辑，mobile 适配 5.5 内测期」 |
| 6 | escalation 自动触发（同型连错 3 次）逻辑误触 | 低 | 现场关掉自动触发，改成手动点按钮 | 「学生主动求助是第二路径，AI 主动分诊是第一路径——今天演第二种」 |

**通用应急原则**：所有翻车都不解释 bug，转化为「**这就是为什么我们做 B 模式（AI + 真人）而不是纯 AI**」。

---

## 五、跟昨天/前天的对比（show progress）

| 维度 | 2026-04-26（前天） | 2026-04-27（昨天） | 2026-04-28（今天） |
|---|---|---|---|
| Prompt 系统 | v1 散落 147 行，无结构 | v2 草稿 fork 成 3 文档 | **v3 主体 305 行 · 单一权威来源 · 5 部分体系闭环** |
| 错题图谱 | 无 | 64 misconception 设计稿 | **/api/error-graph 端点 + parent-radar 自动归类视图** |
| 学长侧 | 无 | escalations 表设计稿 | **/api/mentor-queue 看板 + AI 草稿 + 同型连错 3 次自动触发** |
| 妈妈周报 | 无 | 设计稿 5 段 | **/api/parent-brief deterministic 版 ship · LLM 5 段待加** |
| AI 角色名 | 「清北学姐」 | 「清北哥哥姐姐」 | **「原小点」（统一）** |

5 行表格，5 项硬指标全部从「有想法」推到「有代码」。

---

## 六、给下次接手 session 的 5 句话

写给「下次某个 session 接管这个项目的 AI 或人」：

1. **这个项目是啥**：原点智学 = 中国家庭 AI 学习管家（不是数学老师），定位「学校做不到的那 30%」，AI 角色叫「**原小点**」，B 模式 = AI + 真人学长。
2. **现在到哪**：5.4 demo 前最后冲刺，prompt 体系 v2 + UI v2 + B 模式闭环已 ship，94 个 commit 今天落了 5 个 P0-P1 模块。
3. **接下来该看什么**：先读 `docs/PROMPT-SYSTEM-V2-MASTER.md`（设计源）+ `docs/CHINESE-FAMILY-AI-MANAGER-V1.md`（顶层定位）+ 本文件（实施状态）。然后跑 `git log --since='2026-04-28 00:00'`。
4. **不要做什么**：不要再 fork 散 prompt 文档（PROMPT-V2-DRAFT 等已 deprecated）；不要把 AI 改回「数学老师」（已 pivot 到「学习管家」）；不要给 AI 加紫蓝渐变 / rounded-3xl（v2 视觉系统不允许）。
5. **下一步动作**：明天工程做 4 件事 — parent-brief 加 `?enrich=llm` / escalate 工单结构化 / 学长 AI 草稿 / C 类危机通道。运营做 3 件 — 灌 demo 账号 / 录真孩子试用 / 跑 v3 baseline eval。

---

**版本**：v0.9 草稿 · 2026-04-28 实施验收
**作用**：让团队 4 个角色 review 各自范围；为 5.4 demo 兜底
**作者**：Zack（产品） + 阁主（落地实施）
**下次更新**：等 4 个并行 agent 完成后升 v1.0
