# 原点智学小程序完整产品闭环设计

日期：2026-05-24

## 1. 判断

原点智学的主入口应收束为“孩子今晚先做哪一步”，而不是“上传报告”“小游戏复习”或“老师角色选择”。

原因是现有代码里的所有强能力都依赖同一条证据链：

材料/作业/卡点 -> 孩子说出第一步 -> 错因或卡点被记录 -> 生成回访卡 -> 主动回忆/轻练习 -> 家长只问一句 -> 报告变成 7 天行动 -> 第二天回到首页继续。

因此，产品定义应从“功能集合”升级为：

> 面向中国家庭晚间作业场景的 AI 私教路线系统。它不直接给答案，而是帮孩子先说出今晚第一步，把卡点变成回访，把家长上传的报告变成可执行的 7 天行动。

## 2. 首页优先级

首页只服务一个核心问题：今晚先做什么。

首页允许出现四类下一步：

1. 作业/卡点输入：孩子或家长输入今晚作业、卡住点或材料。
2. 私教第一步：继续上次没有说清楚的第一步。
3. 报告建议动作：家长上传材料后，报告只以“今晚一步”回到首页。
4. 回访卡：昨天修过的卡点今天回访一小步。

首页不应把以下内容作为第一主 CTA：

- 上传测评报告。
- 小游戏/闯关。
- 老师团/角色选择。
- 家长 dashboard。
- 排行榜、PK、分数、提分承诺。

## 3. 端口地图

### 3.1 主用户端口

| 端口 | 当前角色 | 收束后的角色 |
|---|---|---|
| `pages/home` | 今晚入口、续接卡片、分享回流 | 唯一主入口：决定今晚先做哪一步 |
| `pages/tutor` | 作业点拨、追问、私教对话 | Khanmigo 式私教：追问第一步、拦截答案、小课堂/家长转交 |
| `pages/review` | 修卡点、错题回访 | 把卡点修成错因、回访卡和下一步 |
| `pages/focus` | 专注舱 | 围绕已确认第一步坐一段，留下完成证据 |
| `pages/tools` | 轻回访、工具集合、练习入口 | 回访页：今天只回看一小步，游戏和材料都降级为补位入口 |
| `pages/arcade` | 轻练习、游戏化回忆 | Gizmo 式主动回忆游戏：奖励来自真实学习证据，不做假社交 |
| `pages/profile` | 家长复盘、报告、行动卡 | 家长 5 秒复盘：孩子第一步、回访、报告动作和明天一句话 |
| `pages/upload` | 作业/错题/报告材料入口 | 材料入口：作业、成绩、错题、测评报告进入分析并回到行动 |
| `pages/radar` | 弱点雷达/家长判断 | 辅助决策页，不能抢 Profile 首屏 |
| `pages/diagnosis` | 轻诊断/卡点分类 | 服务 Tutor 和 Review 的卡点分类，不做独立诊断墙 |
| `pages/module` | 小学习局/模块学习 | 3 分钟小课堂或小学习局，专门补“第一步说不出”的那一层 |
| `pages/daily-math` | 每日轻口算 | 轻入口，只制造第一步证据和回访卡 |
| `pages/dictation` | 听写小助手 | 轻入口，只记录字形/错因和回访动作 |
| `pages/light-diagnosis` | 手动选题型/轻诊断 | 轻入口，帮孩子把“不会”翻成可问的第一步 |
| `pages/legal` | 协议/隐私 | 上线必备，不进入学习主线 |

### 3.2 桥接能力

| 能力 | 文件 | 产品责任 |
|---|---|---|
| 私教边界 | `miniprogram/utils/tutor-ladder.js` | 三轮追问、答案拦截、第一步小黑板、小课堂/家长转交 |
| 报告分析 | `miniprogram/utils/learning-report.js` | 成绩、错题、测评材料变成分析草稿和建议 |
| 家庭报告 | `miniprogram/utils/family-report-engine.js` | 把报告翻译成家长可执行的行动语言 |
| 服务路径 | `miniprogram/utils/learning-service-pathway.js` | 把报告建议接到 7 天验证和行动闭环 |
| 复习卡 | `miniprogram/utils/review-cards.js` | 主动回忆、调度、错因修复和奖励证据 |
| 游戏逻辑 | `miniprogram/utils/arcade-engine.js`, `miniprogram/utils/game-logic.js` | 把复习卡变成可玩的主动回忆，不变成娱乐外壳 |
| 分享接力 | `miniprogram/utils/share-relay-schema.js` | 只分享第一步、错因、家长问题、回访动作；不分享原题/答案/分数 |
| 真实作业样本 | `miniprogram/utils/real-homework-coverage.js` | 防止私教、报告、游戏变成空泛模板 |
| 产品成熟度 | `miniprogram/utils/product-readiness.js` | 判断本地闭环、商业代码和外部上线阻塞 |
| 导航 | `miniprogram/utils/navigation.js` | 保持“下一步”统一，不让页面各自乱跳 |
| 隐私 | `miniprogram/utils/privacy.js` | 未成年人、上传材料、家长可见字段边界 |
| 服务访问 | `miniprogram/utils/service-access.js` | 明确本地能力和生产服务是否配置，不假装上线 |
| 本地证据账本 | `miniprogram/utils/storage.js` | 串起所有模块的本地事实来源 |

### 3.3 验收和门禁

关键验证脚本包括：

- `scripts/test-product-convergence.cjs`
- `scripts/test-tutor-ladder.cjs`
- `scripts/test-review-engine.cjs`
- `scripts/test-arcade-engine.cjs`
- `scripts/test-report-revisit-loop.cjs`
- `scripts/test-light-heavy-service-loop.cjs`
- `scripts/test-learning-report.cjs`
- `scripts/test-family-report-engine.cjs`
- `scripts/test-share-relay-behavior.cjs`
- `scripts/test-share-relay-safety.cjs`
- `scripts/test-real-homework-pressure.cjs`
- `scripts/test-production-hardening.cjs`
- `scripts/test-commercial-shell.cjs`
- `scripts/miniapp-depth-audit.cjs`
- `scripts/verify.ps1`

这些门禁应证明三件事：

1. 行为闭环成立：上传/输入 -> 私教 -> 修卡 -> 回忆 -> 家长 -> 回流。
2. 安全边界成立：不直接给答案、不泄露原题/完整对话、不晒分、不排名、不假社交。
3. 上线边界成立：真实 AppID、域名、生产 AI/provider、云端持久化是外部门禁，不能用本地体验冒充上线完成。

## 4. 四条闭环支线

### 4.1 AI 私教线

目标：完全承接 Khanmigo 式“引导而不是给答案”的价值。

产品规则：

- 第一轮先确认孩子卡在哪里。
- 第二轮逼近第一步，不输出完整答案。
- 第三轮仍说不出，转小课堂或家长只问一句。
- 孩子要答案、要代写、要完整过程时，必须回到第一步。
- AI 可以改写语气和解释角度，但不能决定最终答案、掌握度、奖励放行、报告结论和分享字段。

成功证据：

- `tutor-ladder` 生成追问状态和边界证据。
- `tutor` 页面写入 `tutorMessages`、`tutorEvents`、`todayFocus`。
- `profile` 能展示“没有给答案，只记录孩子自己的第一步”。

### 4.2 小课堂线

目标：承接千问式“小课堂/板书解释”的启发，但只补入口，不讲完整题。

产品规则：

- 小课堂只在“孩子说不出第一步”“小黑板提示不够”“同类迁移失败”时出现。
- 每次只讲一个概念缺口或一个可画动作。
- 输出必须包括：小黑板一笔、孩子复述问题、家长只问一句、明天回访。
- 禁止输出原题、完整答案、分数、排名、天赋标签和完整对话。

成功证据：

- `homeViewModel.miniLessonResume` 能把小课堂回流到首页。
- `review` 能承接小黑板和修卡动作。
- `profile` 能把小课堂转成家长可问的问题，而不是讲题记录。

### 4.3 回忆复习/游戏化/社交线

目标：承接 Gizmo 式 active recall、游戏化和分享机制，但保持学习证据真实。

产品规则：

- 游戏只来自真实回访卡、错因卡、材料卡。
- 每局先主动回忆，再核对。
- 错的卡回到 Review，不允许只给奖励。
- XP、徽章、连续天只能来自真实学习动作。
- 社交只做安全接力，不做排行榜、PK、冲榜、晒分。
- 分享卡只带第一步、错因、家长检查和回访动作。

成功证据：

- `review-cards` 调度卡片和回访。
- `arcade` 写回 `wrongAnswers`、`gameEvidence`、`nextPracticePlan`。
- `share-relay-schema` 清理分享字段。
- `home` 能接住分享回流并给出下一步。

### 4.4 家长上传报告分析线

目标：让家长上传成绩、错题、测评报告、学习材料后，不停留在静态报告，而是闭环到小程序行动。

产品规则：

- 上传材料先做确认：材料类型、可信度、缺失字段。
- 报告只给行动建议，不下长期诊断和天赋标签。
- 报告必须生成今晚动作、7 天验证、回访卡或修卡路线。
- 家长看到的是“今晚只问一句”和“下一步怎么验证”，不是报告墙。
- 分数、排名、照片、姓名、联系方式必须从分享和奖励链路中隔离。

成功证据：

- `learning-report` 产生 `recommendationPlan` 和 `localLoopConnection`。
- `family-report-engine` 产生家长可执行语言。
- `recordReportRevisitEvidence` 把 Review/Arcade 结果写回报告验证。
- `profile` 展示报告回访验证状态。
- `home` 显示报告建议的“今晚一步”。

## 5. 页面取舍

### Home

必须成为“统一下一步控制台”。

保留：

- 今晚作业/卡点输入。
- 继续第一步。
- 小课堂回流。
- 报告建议动作。
- 回访卡。
- 分享回流动作。

降级：

- 轻工具矩阵。
- 游戏入口。
- 家长报告入口。
- 老师角色选择。

### Tutor

必须成为“私教守门”。

保留：

- 追问第一步。
- 答案拦截。
- 小黑板/小课堂转交。
- 修卡、专注、家长复盘后继路线。

禁止：

- 完整讲题。
- 直接给结果。
- 展示原题/完整对话给家长或分享。

### Upload / Profile

Upload 是材料入口，Profile 是家长复盘，不要互相抢角色。

Upload 负责：

- 接收作业、错题、成绩、测评报告。
- 识别材料类型。
- 生成今晚路线、修卡点、轻练习或报告草稿。

Profile 负责：

- 汇总孩子第一步证据。
- 展示家长只问一句。
- 展示报告回访验证。
- 发起安全分享。

### Tools / Arcade

Tools 是“轻回访”，Arcade 是“主动回忆游戏”。

必须避免：

- 游戏抢走首页主线。
- 假排行榜。
- 假好友挑战。
- 分数和排名驱动奖励。

## 6. 可执行实施计划

### 第一轮：产品收口文档和门禁对齐

目标：让团队和代码测试都承认同一条闭环。

动作：

1. 把本文档作为主设计稿。
2. 更新或新增一份实施清单，列出每个页面的主任务、禁止事项、输出证据。
3. 检查 `test-product-convergence.cjs` 是否覆盖 Home 统一下一步、报告回流、小课堂回流和分享回流。
4. 检查 `test-real-homework-pressure.cjs` 是否覆盖私教、报告、游戏、分享的一致错因和家长问题。

验收：

- 不改 UI 前，先能用测试和文档说明“完整闭环是什么”。

### 第二轮：Home 统一下一步

目标：首页只显示一个主问题和四类下一步。

动作：

1. 梳理 `home.js` 中 `unifiedNextAction`、`miniLessonResume`、`reportServiceResume`、`yesterdayReviewCard`、`incomingShareRelay` 的优先级。
2. 将首页首屏表达收束为“今晚先从哪一步开始”。
3. 把轻工具、游戏、家长报告都改成下方或条件显示。
4. 增加测试：当报告、回访、分享、小课堂同时存在时，首页按统一优先级显示下一步。

验收：

- 首页不会像工具集合。
- 首页能把所有支线收回一个“下一步”。

### 第三轮：Tutor -> 小课堂 -> Review 闭环

目标：孩子卡住时不漏到完整讲题，而是进入小课堂或修卡点。

动作：

1. 审查 `tutor-ladder` 的失败状态、`miniLessonBridgeReady`、`parent_handoff_required`。
2. 保证 `tutor` 页面失败反馈能清晰显示“去 3 分钟小课堂”或“家长复盘”。
3. 小课堂输出必须写入 review card 或 today focus。
4. Review 完成后必须回到 Tools/Arcade 或 Profile。

验收：

- 要答案、沉默、反复说不会都不会得到完整答案。
- 小课堂不是讲题页，而是“第一步恢复协议”。

### 第四轮：Report -> Action -> Revisit 闭环

目标：家长上传材料后，报告必须变成行动并被验证。

动作：

1. 检查 `upload` 到 `learningReportState` 的保存路径。
2. 确认 `learningReportState.reportServiceResume` 能进 Home。
3. Review/Arcade 完成后通过 `recordReportRevisitEvidence` 写回报告验证。
4. Profile 展示“报告回访验证”，但不释放长期画像或天赋标签。

验收：

- 上传报告不会停在报告页。
- 报告产生的建议能驱动今晚一步和 7 天验证。

### 第五轮：Review / Arcade / Share 社交回流

目标：让回忆复习、游戏化和社交变成留存闭环。

动作：

1. 确认 Review 生成的卡能进入 Arcade。
2. 确认 Arcade 错误能回到 Review。
3. 确认 Share Relay 只带安全字段。
4. 确认 Home 接住分享回流并显示下一步。

验收：

- 不展示假排行榜、假好友挑战、分数排名。
- 分享回流能带来新的第一步或回访动作。

### 第六轮：上线前验证

目标：本地闭环和真实上线门禁分开。

动作：

1. 跑聚焦测试：product convergence、tutor ladder、report revisit、review engine、share relay。
2. 跑 `scripts/verify.ps1`。
3. 同步到 `aiedumini` 前确认真实 AppID 仍是外部门禁。
4. 真实 AppID、微信合法域名、生产 AI provider、云持久化未配置时，不声明已上线完成。

验收：

- 本地产品闭环可试用。
- 上线门禁清楚，不假装完成。

## 7. 未解决风险

1. 源仓当前有大量未提交变更，实施时必须保护既有工作，不做重置或清理。
2. `storage.js` 已非常大，后续如果继续叠功能，需要把报告、分享、游戏、私教边界拆成更明确的模块，但本轮不做无关重构。
3. 小程序当前仍依赖 `touristappid`，真实体验版上传不是代码内可完成事项。
4. 云端持久化和生产 AI provider 是外部上线门禁，不能用本地 storage 冒充 100 人体验能力。
5. 产品强叙事容易滑向提分承诺、天赋标签、排行榜和完整讲题，必须由测试持续拦截。

## 8. 决策

采用“孩子今晚作业路线优先”的收口方案。

家长报告、回忆游戏、社交接力、小课堂、轻入口都不作为主入口，而是变成“下一步”的来源。

实施原则：

- 首页只问今晚一步。
- 私教只追第一步，不给答案。
- 小课堂只补入口，不讲整题。
- 游戏只奖励真实主动回忆。
- 社交只分享安全动作。
- 报告只释放行动，不释放长期标签。
