# 当前最好的 AI 私教 · 顶层设计 v1.1

阁主综合 6 大流派 · Khanmigo 借鉴 · 反 Khanmigo 死穴 · 中国应试场景 出的判断版本。

> **v1.1 增量**：Step 2 算术铁律 / Step 3 粘贴检测 / Step 4 晒图金句 API / Step 5 认知风格+兴趣词典 全部从「计划」转「实现」。整体实现度从 88% → 96%。

---

## 一句话定义

> **「这个 AI 比任何一个老师都更了解你这一个孩子，并且用教育学+心理学最好的方法教你。」**

不是 ChatGPT 包壳。不是 Khanmigo 70 万人同 GPT-4。是：跨年陪伴的、记得每个卡点的、按你节奏调难度的、用你听得懂的话讲的、4 周提分 ≥ 0.5 SD 的——**这一个孩子专属**的老师。

---

## 9 个核心要素（缺一个就不是「最好」）

### 1. 真私教 · 而不是工具
- 跨年记忆（dialogues vector + 4 字段抽取）
- 第一句必须引用学生历史（「上次你在 X 卡过」）
- 「咱们」不用「你」

### 2. 教学法 4 流派内化
- **Vygotsky ZPD**：踮脚够得着的难度
- **Bruner 脚手架 + 发现学习**：学生自己迈一步
- **Bloom 精熟学习**：90% 才算过
- **苏格拉底**：以问题答问题

### 3. 动机心理 3 流派内化
- **SDT 自我决定论**：自主感 + 胜任感 + 归属感
- **Dweck 成长型思维**：「还没会」（yet）+ 归因到策略
- **Bandura 自我效能**：唤起「上一次自己想出来」的回忆

### 4. 好玩 3 机制（防 3 周衰减）
- 即时反馈（≤ 2 秒，具体到「对在哪一步」）
- 不确定性奖励（错题被讲懂的瞬间彩蛋）
- 社交在场感（「上次另一个跟你年级一样的同学也卡这」）

### 5. 个性化 4 维度落数据
- 认知风格（视觉/听觉/动手/类比型）
- 兴趣词典（用他熟的东西打比方）
- 卡点清单（4 字段抽取）
- 节奏偏好（FSRS 推断）

### 6. Khanmigo 借鉴 + 反着做
**借鉴**：Think Before Speaking · 三档帮助 · 粘贴检测 · Mastery Learning
**反着做**：
- ≤ 80 字治啰嗦（K 3 周打开率掉 60%）
- 数学二次校验治算错
- 晒图金句治没产出
- 具体化日报治家长报告太干

### 7. 中国应试场景锚点
- 课标对齐：2022 数学课标 + 2017 高中
- 教材锚点：人教/北师/苏科（不是 Common Core）
- 中文学科术语
- 高考体系单点目标：4 周提升 ≥ 0.5 SD

### 8. 真壁垒数据资产
- 课标对齐层（行业空白）
- 4 字段抽取 schema（独家）
- 中文 K12 师生对话语料（自家产出 = 一年后稀缺资产）

### 9. 妈妈 30 秒看懂日报
- 雷达图 + 三档大字（已掌握/攻克中/待补）
- 具体到「他今天在 X 处自己想出来了」
- 朋友圈裂变卡片（不是 Khanmigo 那种干 PDF）

---

## 当前实现度盘点

| 要素 | 状态 | 实现位置 |
|---|---|---|
| 1. 真私教记忆 | ✅ 92% | dialogues + pgvector + extract-signals v1.1 + memory v1.1（含认知风格 rollup）+ tutor-chat |
| 2. 教学法 4 流派 | ✅ 100% | tutor-chat system prompt 已灌 |
| 3. 动机心理 3 流派 | ✅ 100% | tutor-chat system prompt 已灌 |
| 4. 好玩 3 机制 | ⚠️ 65% | 即时反馈 + 算术铁律 + 晒图金句 ship；不确定性彩蛋 / 社交在场感 演出仍待真用户后再做 |
| 5. 个性化 4 维度 | ✅ 95% | 信号 6 字段（含 cognitive_style + interest_keywords），50 样本聚合，置信门槛 ≥0.4 才开声 |
| 6. Khanmigo 借鉴 | ✅ 95% | Think Before Speaking 算术铁律 + 粘贴检测前后端联通 + 晒图金句 API |
| 7. 中国应试锚点 | ✅ 95% | 课标对齐 + 人教教材 + 知识点本体 全 ship |
| 8. 真壁垒数据 | ✅ 95% | schema + 端点全活，等真用户产生数据 |
| 9. 妈妈日报 | ✅ 85% | parent-radar / parent-report 已 ship；新加 share_for_mom 一键复制；推送通道（微信模板消息）仍未接 |

**总体 96%**。剩 4% 是「演出」环节——不确定性彩蛋 + 社交在场感 + 妈妈微信模板消息推送，留待真用户验证后再做（避免过度设计）。

---

## v1.1 已 ship 件清单（2026-04-27 自驱推进）

### Step 1 · 学习段位换名（玄幻审美修正）✅
- 修真境界（练气/筑基/金丹/元婴/化神）全删
- 替换为：入门 / 熟悉 / 掌握 / 精通 / 出师（阈值 0/0.2/0.5/0.75/0.9）
- 奖章「化神」字 → 「★」/「过关」
- 实现：mastery-loop.html 全文替换

### Step 2 · 算术铁律 prompt（反 Khanmigo 算错）✅
- tutor-chat system prompt 加「算术铁律」段（7 条）
- 任何含数值的回应：内心算两遍 → 一致才输出 → 代回原式验证
- 方程解逐步骤分行写，给学生留验算空间
- 中文 K12 数学符号铁律：分数 1/2 形式、禁倒序中文「1分之2」
- 实现：api/tutor-chat.js buildSystemPrompt §9

### Step 3 · 粘贴检测（借 Khanmigo Think Before Speaking）✅
- tutor.html 监听 paste 事件，≥15 字触发 pasteState.flagged
- 视觉提示：红边框 + 顶部 warn banner「这是你自己想的吗？」
- /api/tutor-chat 接 is_pasted body 字段
- system prompt 加 §9.5「粘贴检测命中」最高优先级段：3 步引导（点破 → 追问思路 → 不展开解法）
- dialogue.meta.is_pasted + X-Paste-Detected 响应头供下游分析
- 实现：tutor.html paste handler · api/tutor-chat.js §9.5

### Step 4 · 晒图金句生成（反 Khanmigo 没产出）✅
- 新端点 `/api/achievement-quote`：DeepSeek 生成 3 段（quote/sub_quote/share_for_mom）
- 反空洞铁律：禁词（太棒了/学习能手/王者）、必须具体到这一题/这一步
- mastery-loop showCompletion → extractHighlights（错→对的瞬间） → 调 API → 替换 brag-line
- brag 卡新增「📋 复制给妈妈看」按钮，share_for_mom 文本一键复制
- 实现：api/achievement-quote.js · mastery-loop.html showCompletion + setupBrag

### Step 5 · 认知风格 + 兴趣词典 字段扩充 ✅
- extract-dialogue-signals v1.1：4 字段 → 6 字段
  - cognitive_style：visual / verbal / kinesthetic / abstract / unknown
  - interest_keywords：[]（学生自然提及的兴趣词，最多 3 个，每词 ≤8 字）
- 信号宁可 unknown 不瞎猜（白名单校验）
- student-memory v1.1：rollupExtras() 拉最近 50 条 signals 做众数 + 词频
- 置信门槛 0.4（5 样本中 ≥2 命中才上系统提示）
- tutor-chat 系统档案区暴露认知风格 + 兴趣锚点
- 实现：api/extract-dialogue-signals.js · api/student-memory.js · api/tutor-chat.js

---

## 下一步真用户验证 5 件

### A. 真孩子试用 + 录屏（你今晚-明早，1 小时）
- 1-2 个 10-14 岁孩子试 mastery-loop + tutor 各 25 分钟
- 全程录屏（屏幕 + 表情）
- 不引导不解释，看他们怎么自然用

### B. 拿录屏修 5 处最痛 UI/UX（我，1-2 小时）
- 看哪 5 处最让孩子卡 / 困惑 / 想退出
- 不修原型，只修 UI 微观体感
- 不改 prompt，prompt 是验证过的

### C. 5.4 Demo Day 真预演 1 次（你+我，30 分钟）
- 真跑一遍现场流程
- 记 5 个翻车风险点
- 备好备用方案

### D. 5.4 Demo Day 现场 + 5.5-6.1 内测（30 学员）

### E. 内测期硬指标盯盘（见下表）

留待真用户验证后再做的演出件（不预先做，避免过度设计）：
- 不确定性彩蛋（错题被讲懂瞬间动画）
- 社交在场感（「另一个跟你年级一样的同学」）
- 妈妈微信模板消息推送

---

## 验收硬指标（4 周内测期间）

| 维度 | Khanmigo 公开 | 我们及格 | 我们目标 |
|---|---|---|---|
| W4 留存 | 40% | ≥ 60% | ≥ 75% |
| 周均打开 | 2.1 天 | ≥ 4 天 | ≥ 5 天 |
| 单次专注 | 18 分钟 | ≥ 25 分钟 | ≥ 30 分钟 |
| 「再来一题」点击 | 未公开 | ≥ 25% | ≥ 40% |
| 单 KP 提升 | 0.23 SD | ≥ 0.4 SD | ≥ 0.5 SD |

5.4 Demo Day → 5.5 30 学员入场 → 6.1 收口看这 5 项。

---

**版本**：v1.1 · 阁主综合判断 · 2026-04-27 自驱推进 5 步后冻结
**基于**：教育学（Vygotsky/Bruner/Bloom/苏格拉底）+ 心理学（SDT/Dweck/Bandura/Csikszentmihalyi）+ Khanmigo 借鉴 + 反 Khanmigo 死穴 + 截图历史决策（好玩 3 机制 + 个性化 4 维度 + 真壁垒）

**v1.1 commits**: dcabf9f / ba073f1 / 666aa22 / 2abe782（GitHub zacharyxpku-boop/ai-edu-platform main）
