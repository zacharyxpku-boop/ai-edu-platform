# 5.4 Demo 阁主级硬审 · Final Audit
**版本**：v1.0 终稿（已收并行 agent 第四波）
**审查时间**：2026-04-28 16:25（北京）
**审查官**：Reality Checker · 默认怀疑模式
**审查范围**：今日 119 commit + 4 波并行 agent 落地件 + 4 项用户具体指令

> **一句话定调**：**这是好骨架，不是好产品**。code 全 ship，但**真孩子 0、真家长 0、真学长 0**，单项信心天花板 = 85%。
> 5.4 demo 现场最大风险**不是技术**——是「评委合规三连」+「真孩子开场就走」。

---

## Part 0 · v0.5 → v1.0 改了什么

第四波 Agent 在 v0.5 提交后又 ship 了 4 件：
- **Agent A**（17:11 已 push 117db87）：苏格拉底度自适应 + 算术 3 步校验 + 同点追问计数防烦
- **Agent B 合规**：terms.html / PRIVACY-POLICY.md / TERMS-OF-SERVICE.md / `/api/student-data-export` / welcome.html consent checkbox / 0011_data_retention.sql（**6 个文件未提交**）
- **Agent C AI 加固**：bkt.js IRT-2PL + diagnose.js fallback 池 + moderation.js LLM 二审 + fsrs-update.js FSRS-4.5（**5 个文件未提交**）
- **Agent D 学情骨架**：scripts/cluster-student-archetypes.py rule-based 5 archetype（**未提交**）

**剩 12 个文件未 commit、未 push**。这是**今晚最大风险**——Agent 改完没收尾。

---

## Part 1 · 信心矩阵（0-100%）

> 评分逻辑：commit ship +50% / 端点 curl 实测过 +20% / UI 真点过 +15% / 真用户验证过 +15%
> 今天没有真用户验证，单项天花板 = 85%。**未 commit 的件最多给 60%（随时可被人 git checkout 抹掉）。**

| # | 模块 | 信心 | 风险点 |
|---|------|------|--------|
| 1 | v3 prompt 苏格拉底度自适应 | **80%** | Agent A 117db87 已 push · 同 KP 4 档追问上限 + 烦躁信号 4 类 + 学生主动要答案 3 档处理 + 算术内心算两遍。**没真孩子触发过烦躁信号**——`stuck_count ≥3` 是黑盒 |
| 2 | 算术二次校验 | 75% | Agent A 117db87 已 push · prompt 里写「内心算两遍 + 代回验证」。**LLM 真听不听是黑盒**，没有服务端真校验数值——arithmetic 数学题 LLM 还是有概率算错 |
| 3 | AI hallucination 后处理（post-process.js） | 70% | post-process.js 160 行 ship 但**未 commit**（untracked）· 6 类正则覆盖伪研究/伪年份/伪权威/伪统计。已 import 进 tutor-chat.js。**漏的 case：「我同学小明」「上次有个学生」编故事** |
| 4 | moderation LLM 二审 | **70%** | Agent C 加 callDeepSeekJudge 给 deepseek-chat 判断关键词命中是误报还是真事故 — **未 commit**。逻辑只有 severity≥3 触发；但**没人测过 ratelimit**，DeepSeek 限流时 fallback 会跳过二审退到启发式 |
| 5 | diagnose fallback 池 | **70%** | Agent C 加 35 条 misconception JSON pool + 字符 2-gram Jaccard 相似度匹配（中文友好不依赖分词）—— **未 commit**。Edge runtime 双路加载（动态 import + origin fetch fallback）。**没跑过真 case**——35 条覆盖率够不够初一第 3 章是黑盒，其它章直接漏 |
| 6 | 合规同意条款（welcome.html） | **65%** | Agent B 加 2 个 checkbox + 自动校验—— **未 commit**。前端勾选有，后端 student-init.js 是否真把 consent_v1 写库要再确认。**14 岁以下监护人核身没做**（一勾就过） |
| 7 | TOS / Privacy 占位页 | **70%** | Agent B 已写 PRIVACY-POLICY.md (210 行) + TERMS-OF-SERVICE.md (128 行) —— **是 .md 不是 .html**。welcome.html 链接 `/terms` `/privacy` 但**没建 terms.html / privacy.html 路由**——点进去 404 |
| 8 | 数据导出端点 | **75%** | Agent B ship `/api/student-data-export` 216 行 · 找回码轻鉴权 + 24h 限 5 次 + 导出 7 表 —— **未 commit**。**Edge runtime 大表查询会超时**（dialogues 一年下来上万条）；**没 UI 入口**，只有端点，家长怎么调用是问号 |
| 9 | AI 边界明示 | 65% | onboarding 4 段消息已 ship · v3 prompt 提示「我是原小点 AI 学习管家」。**tutor 气泡缺「AI 生成」≤8px 标识**——COMPLIANCE-AUDIT 风险 2 没修。生成式 AI 备案要求未实施 |
| 10 | BKT + IRT-2PL | **70%** | Agent C bkt.js v2.0-irt2pl 已写 · 公式 `P=1/(1+exp(-1.7*a*(mastery-b)))` + 惊讶度 ±0.05~±0.15 —— **未 commit**。**致命问题：题库里 discrimination(a) 全是默认值 1.0**——所有题 a=1 等于 IRT 形同虚设。需先批量补题库 a 字段 |
| 11 | FSRS-4.5 | **75%** | Agent C fsrs-update.js 升级到 17 参数 + power-law decay + lapse 公式分支 —— **未 commit**。`_fsrs-weights.json` 也是 untracked。**没跑过真学生连续 3 周数据校准**——参数停留在论文经验值 |
| 12 | archetype 聚类 | **55%** | Agent D `scripts/cluster-student-archetypes.py` 319 行 rule-based 5 类 —— **未 commit · 是 Python 脚本不是 API · 没 cron**。`students.goals.archetype` 写库逻辑写了，**没人手动跑**。5.4 现场所有学生 archetype = null |
| 13 | 知情权三态（opt_out/summary/in） | 70% | student-init.js + tutor.html 已 ship · privacy_mode 三档落库。**parent-radar 没接**——家长打开看到的还是全部，三态形同虚设 |
| 14 | Think Before Speaking 5 步 | 80% | 3407b7a 已 push · prompt §4 追问策略嵌入 + X-Hint-Level 响应头。**5 步是否真触发是黑盒**——LLM 自己说有想就有想 |
| 15 | 错题图谱（mistake-graph.js） | 80% | 端点 ship + parent-radar 接了。**64 misconception 是 Khanmigo 英文标签，本土化映射没人做**——AI 给孩子说「你是 misconception_007」纯抽象 |
| 16 | mentor AI 草稿（mentor-reply-draft.js） | 75% | 304 行端点 ship + mentor.html 按钮。**没真学长用过**——草稿质量不可知，学长接受率没埋点 |
| 17 | 妈妈五段周报（parent-brief.js ?enrich=llm） | 80% | 581 行端点 ship + 三层兜底。**LLM 生成话术没念给真妈妈听过**——可能写「mastery 提升 12%」这种家长不懂的指标 |
| 18 | T1-T7 分诊（escalate.js） | **70%** | 559 行 + 0008 migration + 9/9 自测过。**db migration 0008 没上生产**——生产环境一调 escalate.js 就 enum 报 500。⚠️⚠️⚠️ |
| 19 | T6 危机热线 | 65% | escalate.js T6 priority=1 + 010-82951332。**话术没声明「我不是专业咨询师」**——COMPLIANCE-AUDIT 风险 3 没修。法律暴露面在 |
| 20 | 学情档案（student-dossier.js） | 80% | 端点 ship · escalation.context 自动塞 dossier。**6 字段画像 demo 数据未灌**——空 dossier 学长拿到等于没拿到 |

**20 模块平均分**：约 **72.0 / 100**（v0.5 的 60 升到 72，因为第四波 agent 把 4 个红字救了出来）
**红字 ⚠️ 模块**（< 70%）：3 个（archetype 55、AI 边界 65、合规 checkbox 65、T6 话术 65、CTO 危机 65 共 4-5 个临界）
**v0.5 vs v1.0 真核心差距**：第四波 4 件全 ship 但 12 个文件**没 commit、没 push**——这是「写完了」≠「ship 完了」

---

## Part 2 · 5.4 Demo 现场最可能翻车 5 点

> 排序逻辑：概率 × 损失 × 暴露面（监管/家长/孩子/技术四个维度）

### 翻车点 1 · 12 个 Agent 文件没 commit, 5.3 凌晨 git checkout 一次全没了
- **场景**：今晚或明早某个 Claude session 跑 `git stash drop` / `git checkout .` / 误清理 → bkt IRT、diagnose fallback、moderation 二审、archetype 脚本、TOS、Privacy、export、welcome consent **全部蒸发**。打开 demo 时所有「v1.0 升级」回退到 v0.5 状态。
- **概率**：**高**（多个 agent 并行 + 工作目录有 12 个 untracked，typical session cleanup 必踩）
- **损失**：**极高**（半天工作量 + Part 1 矩阵的 v1.0 升级一次清零）
- **应急话术**（≤30 字）：「v1.0 件还在 staging，5.4 demo 跑 staging 分支」
- **预防动作**：**今晚 21:00 前**必须批量 `git add` + commit + push 12 个未追踪/未提交件，否则风险无解

### 翻车点 2 · escalate 在生产 500 报错（migration 0008 + 0010 + 0011 都没跑）
- **场景**：你现场点 tutor 上的「呼叫学长」，escalations 表 enum 没加 `crisis/cross_chapter/out_of_scope` → 前端转圈。Agent B 又加 0011_data_retention.sql, 0010_moderation_logs.sql 也没上生产 → moderation 整链路挂。
- **概率**：**高**（明天才跑 migration）
- **损失**：**高**（B 模式闭环演不出来 = 整场最有差异化的 5 分钟没了）
- **应急话术**：「先看 staging 录屏，prod migration 在跑」
- **预防动作**：**今晚必须**手动跑 0008 + 0010 + 0011 三个 SQL 上生产 + curl `/api/escalate` `/api/moderation` `/api/student-data-export` 验证

### 翻车点 3 · 评委「合规三连」+ 真孩子开场即走神
- **场景**：评委里有教育合规背景，问「你这 14 岁以下监护人怎么核身的」「你深度合成内容标识在哪」「数据导出 UI 入口在哪」。welcome.html 一勾就过、tutor 气泡没 AI 标识、export 只有端点没 UI。或者真孩子上台 30 秒说「我不想做」AI 进疲态分支「先停」——评委看到「这玩意 5 句就劝退」。
- **概率**：**中**（合规背景评委 30%）+ **中**（开场无真孩子测过）
- **损失**：**极高**（任一发生直接踢出候选）
- **应急话术**：「合规 v1 已审完（指 docs/COMPLIANCE-AUDIT-V1.md），3 项 P0 5.5 内测前补齐」+「这就是为什么我们做家长周报+学长——AI 不行有人接」
- **预防动作**：**5.3 必须**①真孩子录 30 分钟兜底视频 ②welcome.html consent 勾完真要校验 14 岁以下监护人 ③tutor 气泡加「AI 生成」灰色 ≤8px ④建 terms.html / privacy.html 真路由（现在只有 .md）

### 翻车点 4 · DeepSeek 限流 → tutor-chat / parent-brief / mentor-draft / moderation 二审四处一起挂
- **场景**：5.4 上午 9 点 demo，DeepSeek 限流 / Key 失效。tutor 不出字、周报不生成、学长草稿不出、moderation 二审退到启发式（**让脏话/伤害词漏过升级**）。
- **概率**：**中**（DeepSeek 历史限流过；今天没 mock 演练降级路径）
- **损失**：**高**（核心 demo 全断 + 安全护栏自动失效）
- **应急话术**：「这就是为什么我们三层兜底，看 deterministic 保守版」
- **预防动作**：**5.3 晚必须**拔 DEEPSEEK_KEY 真跑 4 个端点；moderation 二审失败时启发式仍要正常 escalate（保安全底）

### 翻车点 5 · IRT a 字段全是默认值，BKT 数据看上去诡异
- **场景**：评委问「你这 mastery 怎么算的」，你打开 progress.html / parent-radar 看 mastery 曲线——所有学生都几乎一样的轨迹，因为题库 discrimination=1.0 全默认 → IRT 不区分题。曲线没说服力。
- **概率**：**中**（IRT 公式上线 + 题库 a 字段空 = 必发生）
- **损失**：**中**（评委不会立即识破，但有数据科学背景一眼看出）
- **应急话术**：「a 字段 5.5 内测期校准，今天先看 BKT 主路径」
- **预防动作**：**先不演 mastery 曲线**；或者预先给 demo 学生题库手填 5-10 道有差异 a 值的题

---

## Part 3 · 5.5 内测期 30 学员 6 个真信号

> 不要看「DAU 涨了 X%」这种废指标。任何一条踩到下限 = **立刻停下找原因**。

### 信号 1 · W1 流失率
- **下限**：**≤ 60%** —— 30 个学员，第 8 天还有 ≥ 12 个回来用至少 1 次
- **超过下限怎么办**：
  - 1) 立刻拉走的 18 人微信问 3 句：什么时候停的、最后一次用什么坏了、要不要钱回
  - 2) 排查开场 prompt——70% 流失发生在第 1-2 次对话
  - 3) 一周内出 v3.1 prompt 改开场，重新邀请 5 人测

### 信号 2 · 周均打开天数
- **下限**：**≥ 3 天 / 周** —— 留下来的人至少一周用 3 天
- **超过下限怎么办**：
  - 1) 看 parent_pushes 表是不是真在每天推
  - 2) 看 tutor.html 是否有「今天来了吗」回访 hook（**目前没有**）
  - 3) 上线 streak / mini-progress 顶部胶囊持续点亮

### 信号 3 · 单 KP mastery 4 周提升
- **下限**：**≥ 0.20**（学员从 0.30 起步，4 周后 ≥ 0.50）
- **超过下限怎么办**：
  - 1) 不是 BKT 算错就是 IRT 没生效——看 student_states 的 mastery_trace
  - 2) 检查题库 difficulty / discrimination 字段是否真填——很可能全是默认值，IRT 形同虚设
  - 3) 灌真教材题，去掉合成数据

### 信号 4 · 学长 escalation 30min 内回复率
- **下限**：**≥ 80%** —— 30 学员一周 ~10 单工单，8 单 30 分钟内被学长接走
- **超过下限怎么办**：
  - 1) mentor.html 没人盯——加企业微信 push 或短信 fallback（**目前都没**）
  - 2) AI 草稿质量太差，学长懒得改——降草稿门槛或砍掉这步
  - 3) 工单太多——说明 AI 太弱，得回头改 prompt

### 信号 5 · 妈妈周报点开率
- **下限**：**≥ 50%** —— 30 个家长，每周日发 30 封，至少 15 封被点开看完
- **超过下限怎么办**：
  - 1) headline 写得太「指标化」（妈妈不懂 mastery%）——改用「本周孩子终于敢主动讲题了」这种叙事句
  - 2) 推送时间错（周日晚 19:00 是默认，可能要改周六上午）
  - 3) 加微信公众号 push，不只走 push 通道

### 信号 6 · NPS 推荐数
- **下限**：**≥ 5 个家长主动推荐** —— 30 户里有 ≥ 5 户在群里@别人或转介绍
- **超过下限怎么办**：
  - 1) 用户喜欢但没动力推——加裂变机制（推荐 1 人免一周费）
  - 2) 用户其实没那么喜欢——回看信号 1-3，先把基本盘做好
  - 3) 没给推荐工具——加「转给闺蜜」海报生成器

---

## Part 4 · 该做但今天没做的 P0 · 3 件

诚实告诉你短板。这 3 件**5.4 demo 现场没就没了，但 5.5 内测前必须补**。

### 没做 1 · 学长真招募 + onboarding 流程
- **状态**：mentor.html 是个空看板，**没人在 mentor 端口**
- **影响**：5.5 内测开始第一天，学生触发 escalation → mentor 无人 → 30 分钟回复率自动 0%
- **不做也能上场的理由**：5.4 demo 演的是「触发 + 自动判断 + AI 草稿」，不演真学长接管
- **5.5 前必须**：找 3-5 个北大学生 / 在校研究生，给一份 mentor onboarding 文档（不到 1 页），跑通真接管 1 单

### 没做 2 · GTM / 增长渠道 0
- **状态**：**家长来源完全没设计**。30 个内测学员从哪里来？
- **影响**：5.5 内测开始招不到人 / 招的全是熟人 = 信号失真
- **不做也能上场的理由**：demo 是产品演示不是招商
- **5.5 前必须**：定 1 个渠道（小红书 5 篇 + 公众号 1 篇 + 妈妈群 3 个）+ 设计 1 张转化海报 + 招募 landing page

### 没做 3 · 商业支付通道 / 定价 / 收钱路径
- **状态**：membership.html 有页面但**没接支付**。免费内测怎么转付费、定价 ¥X / 月还是 ¥XX / 学期都没确认
- **影响**：5.5 内测结束转化率 = 0
- **不做也能上场的理由**：MVP 阶段先验证留存
- **5.5 前必须**：跑 5-10 户家长付费意愿访谈，定价做 3 档 A/B（¥99/¥199/¥399）

---

## Part 5 · 给阁主的一句话

**今天 ship 了一个能演的骨架，但 12 个 agent 文件没 commit，明天最大风险不是技术——是 5.3 凌晨某个 session 一个 git checkout 把半天工作量抹了，然后评委合规三连问 + 真孩子开场就走，三件叠加直接翻场。**

5.3 必须做 4 件：
1) **今晚 21:00 前**批量 `git add` + commit + push 全部 12 个未追踪/未提交件，**优先级最高**；
2) 跑 `0008 / 0010 / 0011` 三个 migration 上生产 + curl 5 个端点真验收；
3) 找 1 个真初一孩子录 30 分钟开场录屏（兜底用，现场播录屏不真演）；
4) 拔 DEEPSEEK_KEY 演练降级，4 个端点逐个跑过 fallback；moderation 二审 fail 时启发式 verdict 仍要正常 escalate。

剩下的 archetype 真跑、IRT 题库 a 字段、FSRS-4.5 weights 校准、学长真招募、GTM、支付——5.5 内测期再做。

---

**审查官**：Reality Checker
**版本**：v1.0 终稿（v0.5 草稿 + v1.0 收第四波 agent）
**下次审查**：5.4 demo 当晚 21:00（看真演了什么、什么真翻了）
