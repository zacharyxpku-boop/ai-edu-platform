# KA-LOCALIZE 里程碑 v1 · 把可汗学院骨架移植到中国 K12 高考升学场景

> 完工日期：2026-04-28
> 范围：本轮 /loop 自驱周期内累计 23 个 commit 的可演示成品快照
> 目的：demo day 展示用一页清单；新成员 onboarding 先读这份再读代码

---

## 1. 顶层故事

可汗学院最强的不是题库，而是「认人 → 引导路径 → 即时反馈 → 仪式感留存」这套循环。本轮把这条循环逐段中国化、本土化到原点 AI 学堂：

| KA 原型 | 本仓中文化呈现 | 作用层 |
|---|---|---|
| Course pages（math / physics …） | `/subjects/<key>.html` 8 学科枢纽 | 内容入口 |
| Mastery map（grid 色块） | `paths.html` 18px 章节方块 4 阶色阶 | 进度可视化 |
| Streak（火焰天数） | `src/streak-bar.js` 5 档火苗组件 | retention 仪式 |
| Up next for you | `subject-hub.js` + `today-recos.js` 4 档智能卡 | 决策降本 |
| Mastery challenges | 错题本「考前冲关 5 题」+ trophy 奖章 | 主动出击 |
| Parent dashboard | 学科页底「💌 给家长看」+ 一键复制微信简报 | 反虎妈视图 |
| Daily streak counter (quiz) | quiz.html 顶部 sessionStorage 连对计数 | 单页正反馈 |

---

## 2. 模块清单（本轮上线 / 升级）

### 2.1 内容入口层

- **`/subjects/math.html | physics.html | chinese.html | chemistry.html`**：4 页静态色调一致的学科枢纽，每页都有圆环 mastery、教材列表、错题切片、6 个学科专属工具卡
- **`/subjects/index.html?key=biology|history|geography|politics`**：单文件 registry 驱动，复用同一引擎覆盖 4 学科，加 1 学科只改 `REG` 配置块
- **`/src/subject-hub.js`** 渲染引擎：manifest + read + outcomes + errors 四叉数据合流，paint(stage) 切学段重算所有指标

### 2.2 学习地图层

- **`paths.html`**：56 本人教/统编教材按 学段 → 学科 → 年级 → 教材 → 章节 五级展开
  - 章节小方块 4 阶色阶（未碰 / 读过 / 读+练 / 已掌握）+ 红色错题优先 + 金圈冲关印记
  - 学科行 mastery 百分比 chip + 错题章数 chip + 冲关章数 chip
  - 默认按 `yd:my_grade` 锁定学段 tab；URL `?stage=高中` 可 override

### 2.3 个性化推荐层

- **`src/today-recos.js`** 升级：新增 `pickUpNext()` + `renderUpNextBanner()` 4 档优先级
  - A 错题到期（红） → B 学生年级智能选学科（蓝） → C 教材广度不足（琥珀） → D 每日一题兜底（绿）
- 落点：首页 9 学科 grid 上方 / paths streak 之下 / errors 页顶部 + 学科页 hero 之下
- **`src/streak-bar.js`**：5 档火焰强度 + 今日动作数 + 本周章节数 + 历史最佳，全站三页（paths / progress / errors）共用

### 2.4 主动出击层

- **错题本 5 题冲关**：`pickChallengeBatch()` 找同章节 ≥5 道 active 错题打包 → 5 题全对 +20 XP + 写 `ydzx_challenge_clears_v1` 永久记录
- **冲关战利品墙**（progress 页）：每关一张琥珀色奖章卡 + 单关分享 + 全部分享，走 YdzxShare 模板
- **冲关印记可见性**：path 章节小方块金圈 + 学科页 hero meta「🏆 冲关 N 章」+ 教材卡内 inline chip

### 2.5 家长视角层

- 学科页底「💌 给家长看 · X 本周一眼读懂」
  - 7 天滚窗 stats（读章/做题/对率/通关/错题）
  - 4 档状态机（突进期 / 稳推进 / 卡顿 / 起步中）
  - 反虎妈式建议（"不要再加任务" / "不要硬推"）
  - 一键复制纯文本简报 → 微信粘贴

### 2.6 时段化决策层

- 学科页「3 套打法预设」
  - 今天 15 分钟（绿，通勤/课间） → 学生年级匹配的下一章
  - 今晚冲一关（红，晚自习） → 错题数动态决定冲关 / 攒题 / 每日一题
  - 周末复盘（紫，周日晚） → `/weekly.html?subject=KEY`

### 2.7 单页正反馈层

- quiz.html 连对计数器：sessionStorage 持久 + 4 档色阶（灰 → 琥珀 ✨ → 橙 🔥 → 紫 🌟）
- 10 连对触发反 dopamine nudge："节奏满了 · 今天可以收工 ✋"

---

## 3. 数据契约（localStorage 单一信源）

| key | 写入方 | 消费方 | 形态 |
|---|---|---|---|
| `ydzx_textbook_read` | textbook-browser | path / hub / parent-view | `{path::chN: ts}` |
| `ydzx_quiz_outcome_v1` | quiz.html | path / hub / parent-view | `{id: {r,d,book,ch,subj}}` |
| `ydzx_errors_pool` | LearningStore | errors / hub / today-recos | `[{id,subject,textbookRef,reviewCount,...}]` |
| `ydzx_challenge_clears_v1` | errors challenge | trophy wall / path / hub | `{path::chN: {ts,label}}` |
| `ydzx_game_profile_v1` | gamification.js | streak-bar / progress | `{streak,daily,...}` |
| `yd:my_grade` | welcome.html | hub auto-stage / path stage / today-recos | `'middle_2' \| 'high_1' ...` |
| `yd:my_name` | welcome.html | parent-view / Up Next / share | string |
| `ydzx_quiz_streak_v1`（sessionStorage） | quiz.html | quiz counter | `{n,best,capped}` |

---

## 4. 验收路径（demo 演示动线）

1. 进 `/welcome` 30s 注册（grade=high_2）→ 跳转 `/`
2. 首页看到 Up Next banner + 9 学科 grid 全亮（4 静态 + 4 registry）
3. 点 数学 → `/subjects/math.html` → 默认锁「高中」tab
   - 看到 mastery 圆环、3 套打法卡、Up Next、教材列、错题切片、家长视图
4. 点教材进 textbook-browser → 读完一章 → 回 hub 看圆环 +
5. 进 quiz.html → 答对 3 题 → 顶部连对 ✨3 出现
6. 进 errors.html → 攒到 5 道同章节 → 「考前冲关 5 题」按钮亮 → 5 题全对 → trophy 写入
7. 回 hub → 教材卡 inline 🏆 1 → 进 progress → 战利品墙第一张奖章 → 点单关分享生成卡
8. 复制家长简报粘贴在演示微信群，让评委看到反虎妈文案

---

## 5. 不在本轮交付内（明确边界）

- 英语学科：manifest 仅 2 本，placeholder 维持「建设中」
- 道德与法治：manifest 无书；初中段政治走「暂未上线」
- 小学（primary_*）：manifest 无小学教材，注册时映射到「全部」学段
- AI 私教 V2 prompt：`buildSystemPromptV2` 已落盘但 `PROMPT_VERSION` 默认 v1
- LLM rerank：v1 实验失败已诚实披露，v2 confidence-aware 待续

---

## 6. 下一波（v1.1 候选）

- 英语 manifest 补全（找人教社英语 PDF 或独立 OCR pipeline）
- 学科 hub mastery 圆环加月度对比（这周 vs 上周）
- 冲关 streak（连续多周通关 N 章触发跨学科徽章）
- 家长简报增值：每周自动生成一张图卡，用 share-kit canvas 直发
- 章节考点细分：每章 mastery 拆到「概念 / 应用 / 综合」三档
- 移动端导航：底部 tab bar 出现率 > 70% 时切换布局

---

## 7. 反思（本轮过程总结）

做对的：
- registry 驱动 + 单文件单引擎，避免重复粘贴 5 次
- 反 dopamine 设计有意而为（10 连对收工提示 / 反虎妈状态文案）
- localStorage 单一信源，零数据迁移即跨页打通
- 每一轮 commit 都有用户可看见的视觉变化，避免纯重构空 commit

做错的：
- 第一轮 LLM rerank 用 50 道样本就上线 95% 自评，被诚实差距审计逼着回退
- 中途有几次想"一次写完所有学科" → 被纠正成 registry 抽象
- 早期 paths.html 的章节方块只用 1-2 阶色，浪费了 2px 8 色 grid 的视觉空间

---

> 这份文档是给"刚加入团队第一天的工程师 / 投资人 / 家长"在 5 分钟内能读懂的入口。
> 想动手改代码：先 `git log --oneline -30` 看 commit 故事，再读对应 source。
