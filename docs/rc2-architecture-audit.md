# RC2 Foundation Rebuild：产品架构与代码架构审计

本轮只做审计，不新增功能，不重构 UI，不改产品主线，不改后端 API，不删除文件。

## 一、当前产品主线

一句话定位：

学校给全班同一份任务，原点私教给每个孩子一条自己的晚间学习路线；孩子今天选择谁，谁就陪他把这条路线走完。

主流程：

```text
作业输入
  -> tonightPlan
  -> todayFocus
  -> miniActionText
  -> reviewCard
  -> profile summary
  -> growth memory
```

对应产品动作：

```text
排顺序 -> 说第一步 -> 修卡点 -> 轻回访 -> 整理给家长看
```

当前核心闭环已经存在，但代码上仍是页面直接读取 storage、review summary、game/profile 历史模块，再在页面里拼装用户可见内容。RC2 的重点不是换产品，而是把“学习状态”和“用户可见 viewModel”拆开。

## 二、核心状态模型

| 对象 | 写入位置 | 读取位置 | 用户可见字段 | 内部 key 泄露风险 | 测试覆盖 | 当前主要风险 |
| --- | --- | --- | --- | --- | --- | --- |
| `companionPreference` | `storage.saveCompanionPreference()`，主要由 home 老师选择入口写入 | home/review/tools/profile 读取 `loadCompanionPreference()` | `selectedLabel`、`companionLine`、stage copy | 中。页面直接拿 preference，但大多通过 `formatCompanionLine()` / `getCompanionStageCopy()` | `test-companion-preference.cjs`、`test-companion-voice-layer.cjs` | 老师人格数据和用户可见 copy 仍在 `storage.js`，缺少独立 voice layer 文件 |
| `tonightPlan` | `createTonightPlanFromInput()`、`saveTonightPlan()`、`updateTonightRouteStatus()` | home/review/tools/profile | `summaryLine`、`routeSteps`、`planItems`、`parentPrompt` | 中。`routeStatus`、step id 是内部字段，页面有直接读取 | `test-tonight-route.cjs`、`test-rc11-first-day.cjs` | 页面直接展示 plan 派生内容，缺少 route viewModel |
| `todayFocus` | `saveTodayFocusFromThought()`、`saveTodayFocus()`、`updateTodayFocusRepair()` | home/review/profile、tools 间接通过 reviewCard | `title`、`issueType`、`sourceText`、`repairStatus`、`progress` | 中高。`issueType` 是中文稳定值，但页面仍直接拼 `todayFocus.issueType`、`repairStatus` | `test-today-focus.cjs`、`test-learning-evidence-flow.cjs` | focus 检测、repair evidence、review card builder 都在 `storage.js`，边界太厚 |
| `issueType` | `classifyIssueType()`、`issueTypeFromThought()` | todayFocus、reviewCard、growthMemory、profile | 中文类型：步骤断点、列式关系等 | 中。已是中文，但仍可能被页面当内部状态直接拼 | `test-today-focus.cjs`、`test-learning-evidence-flow.cjs` | formatter 和 classifier 混在 storage；页面不应直接决定展示方式 |
| `sourceText` | `saveTodayFocusFromThought()` | review/profile/reviewCard | 孩子原话、卡点原因 | 低。是用户原话，但需要截断和脱敏策略 | `test-learning-evidence-flow.cjs` | profile/report 类模块可能把原话放到报告口径里，需 viewModel 控制 |
| `miniActionText / miniActionAt` | `updateTodayFocusRepair()` | review/profile/reviewCard | “孩子说出的第一步” | 低。是用户输入，但需要长度控制和有效性判断 | `test-learning-evidence-flow.cjs`、`test-tutor-ladder.cjs` | 本地证据已成立；暂未进入 sync payload，跨设备会断 |
| `repairStatus` | `saveTodayFocusFromThought()`、`updateTodayFocusRepair()` | review/home/profile/tools route 状态 | 未开始、进行中、已完成等状态文案 | 中。内部值 `not_started/in_progress/completed` 不应裸露 | `test-learning-evidence-flow.cjs` | 页面仍直接判断 `todayFocus.repairStatus`，应由 viewModel 输出状态文案和 CTA |
| `reviewCard` | `ensureTodayFocusReviewCard()`、`buildTodayFocusReviewCard()`、`review-cards.js` 导入逻辑 | tools/review/profile summary | `front`、`backPrompt`、`question`、`answer` | 中。`source`、`template`、`calibrationKey` 是内部字段 | `test-learning-evidence-flow.cjs`、`test-review-engine.cjs` | todayFocus 卡和普通复习卡混在 reviewCards 体系，tools 需要特殊 fallback |
| `reviewEvents` | `appendReviewEvent()`、`reviewCards.reviewCard()`、quiz/repair 流程 | review/profile/reviewSummary | 复习结果、回访记录 | 中。event kind/rating/source 是内部字段 | `test-review-engine.cjs` | profile 用 reviewSummary 构造大量 dashboard/游戏画像，超出主线 |
| `growthMemory / currentGrowthMemory` | 从 `todayFocus` + `reviewCards` 派生，不是独立写入 | home/profile/review/tools | `oneLine`、`weeklyGrowthMemory` | 低到中。已做人话化，但来源依赖 cardCount | `test-growth-memory.cjs`、`test-learning-evidence-flow.cjs` | 逻辑在 `storage.js`，缺少独立 growth-memory 层；重复判断较脆弱 |
| `profile summary` | profile 页面实时 build：`buildParentReport()`、`buildTonightRouteSummary()`、WXML 首屏 | profile | 今天卡在哪、家长只问一句、明天怎么回访 | 中高。profile 同时混入 parentReport、shareCard、gameProfile、commercialUnlock | `test-rc12-ui-reduction.cjs`、`test-learning-evidence-flow.cjs` | 旧模块残留最重，家长 5 秒复盘与 dashboard/report 混杂 |

## 三、四个 Tab 读写关系

### home

读取：

- `storage.loadState()`
- `reviewCards.reviewSummary()`
- `storage.loadTonightPlan()`
- `storage.loadTodayFocus()`
- `storage.loadCompanionPreference()`
- `storage.getGrowthMemoryLine()`
- module/adaptive path、thinking summary、review cards

写入：

- `storage.saveCompanionPreference()`
- `storage.createTonightPlanFromInput()`
- `storage.saveTodayFocusFromThought()`
- `storage.updateTonightRouteStatus()`
- thinking receipt / tutor event 类记录

风险：

- 页面直接读 `todayFocus.issueType` 并写入 thinking receipt checks，存在把状态字段带入 UI/事件的风险。
- 有 `dashboardHeader`、`proofStats`、`cockpit`、`benchmark` 等旧 dashboard 语义。
- 首屏虽然做过减法，但 JS 数据层仍然加载大量非首屏模块。
- 多个 CTA/入口在数据结构上仍并存，靠 WXML 隐藏或下沉。
- companion 通过 formatter 读取，未见页面固定老师，但页面仍持有 `companionOptions` 全量。

### review

读取：

- `reviewCards.reviewSummary()`
- `reviewCards.sessionCards()`
- `storage.loadTodayFocus()`
- `storage.loadTonightPlan()`
- `storage.loadCompanionPreference()`
- `storage.loadReviewEvents()`
- review card browser/suspended/buried cards

写入：

- `storage.updateTodayFocusRepair()`
- `storage.appendReviewEvent()`
- `reviewCards.reviewCard()`
- 导入/编辑/暂停/修复 note/card 等复习系统状态

风险：

- 首屏主线是 todayFocus repair，但页面同文件里仍包含完整 card browser、quiz、deck settings、导入、suspend/bury 等复习后台能力。
- `repairStatus`、`hasMiniActionDone` 等状态直接在 WXML 判断，后续应由 review viewModel 输出。
- `buildMistakeHub()` 直接把 `todayFocus.sourceText`、`issueType`、reviewEvents 混合成 UI 对象，formatter 使用不完全统一。
- 不存在老师分工/页面固定老师残留，companion 通过 stage copy。

### tools

读取：

- `storage.loadTonightPlan()`
- `storage.loadCompanionPreference()`
- `storage.loadReviewCards()`
- `reviewCards.reviewSummary()`
- `reviewCards.cardBrowser({ source: 'today_focus' })`
- arcade/game recommendations、factory packs

写入：

- 主要写入 review/import/game 相关状态：`importTextToDeck()`、`importGeneratedCards()`、game/open actions
- 本轮主线中不应写 todayFocus

风险：

- 目前已修正：没有 due 的 today_focus 卡时 fallback 读取已生成卡，保证首日闭环不断。
- 页面仍混入 arcade、factory、game modes、material import、大量非主线玩法逻辑。
- “知识游乐场”主线是回访，但代码架构仍像 review/game/content factory 集合。
- `reviewStats.benchmark`、game modes 等会把页面推向 dashboard/游戏化。

### profile

读取：

- `reviewCards.reviewSummary()`
- `storage.loadProfile()`
- `storage.moduleEventSummary()`
- `storage.tutorEventSummary()`
- `storage.thinkingReceiptSummary()`
- `storage.loadTodayFocus()`
- `storage.loadTonightPlan()`
- `storage.loadCompanionPreference()`
- `storage.buildWeeklyGrowthMemory()`
- parent goal、calibration、sync、game profile、share runs

写入：

- share card event
- parent goal
- pilot run
- share intent
- sync/login/pilot/commercial unlock actions

风险：

- 当前最大污染源。首屏目标是家长 5 秒复盘，但页面同时持有 `parentReport`、`wrongCauseSummary`、`dailyShareCard`、`gameProfileCard`、`commercialUnlockCard`、`dataFlywheel`、`benchmarkPosition`。
- WXML 仍渲染多个旧模块区域，只是下沉，不是隔离。
- `buildParentReport()` 仍有“proofScore / proofCards / weakPoint / accuracy”等 report/dashboard 结构。
- 我的页容易从“老师帮孩子整理给家长”滑回“系统给家长管理报告”。
- 需要优先用 `profile-view-model.js` 包装主线输出，旧模块全部放到 advanced/legacy adapter。

## 四、旧模块污染源分类

| 关键词/模块 | 分类 | 当前判断 |
| --- | --- | --- |
| `wrongCauseSummary` | C. 应隔离 | 可以作为后续错因资产，但不应参与 profile 首屏和家长 5 秒复盘 |
| `gameProfileCard` | C. 应隔离 | 属于游戏化成长画像，和 Tonight Route 主线弱相关 |
| `commercialUnlockCard` / `commercialUnlock` | D. 后续可删除 | RC1/RC2 主线禁止会员/支付/商业解锁感，建议后续移除或完全实验隔离 |
| `dataFlywheel` | C. 应隔离 | 更像增长/数据资产叙事，不属于孩子晚间学习路线 |
| `benchmark` / `benchmarkArena` | C. 应隔离 | 内部评估或竞品比较可以保留在工具层，不应进入用户页面 viewModel |
| `shareRuns` | B. 可保留但必须下沉 | 分享/试用传播可作为运营记录，但不能抢家长复盘 |
| `dailyShareCard` | B/C. 可保留但必须下沉，最好隔离 | 当前 WXML 有较明显分享身份卡，和 RC 主线关系弱 |
| `dashboard` / `dashboardHeader` | C. 应隔离 | 直接冲突“一页一个问题”，应从主 Tab viewModel 中移出 |
| `近 7 天错误类型分布` | D. 后续可删除 | 已被产品判断否定，测试应继续禁止 |
| `当前演示判断` | D. 后续可删除 | 已被产品判断否定，测试应继续禁止 |
| `老师分工` | D. 后续可删除 | 已被产品判断否定，老师是全局陪伴人格 |
| `今日老师接手` | D. 后续可删除 | 已被产品判断否定，不应再出现 |
| `小满` | D. 后续可删除/禁用词 | 用户可见禁止；历史 docs 可保留审计，但前台和测试继续禁止 |

A. 当前主流程仍需要：

- `todayFocus`
- `tonightPlan`
- `miniActionText`
- `reviewCard`
- `companionPreference`
- `companion voice`
- `growthMemory`
- `profile summary`

B. 可保留但必须下沉：

- share/pilot 相关能力
- review card browser/deck 管理
- arcade/game 轻练习入口

C. 应隔离：

- wrongCauseSummary
- gameProfileCard
- dataFlywheel
- benchmark
- parentReport 里的 proofScore/proofCards/report 结构

D. 后续可删除：

- commercialUnlockCard
- dashboardHeader 在主页面的入口形态
- 被产品否定的伪 Nova 文案和 demo/dashboard 词

## 五、RC2 目标架构建议

建议目标结构：

```text
miniprogram/
  core/
    focus-detector.js
    tonight-planner.js
    repair-evidence.js
    review-card-builder.js
    companion-voice.js
    growth-memory.js
    formatters.js
  view-models/
    home-view-model.js
    review-view-model.js
    tools-view-model.js
    profile-view-model.js
```

职责边界：

- `focus-detector.js`：`isStuckThought()`、`classifyIssueType()`、`focusNameFromThought()`。
- `tonight-planner.js`：`buildTonightPlan()`、route stage、plan item 排序。
- `repair-evidence.js`：`isValidMiniActionText()`、`update repair evidence` 的纯逻辑。
- `review-card-builder.js`：`buildTodayFocusReviewCard()`、issueType 对应 `front/backPrompt`。
- `companion-voice.js`：`COMPANION_OPTIONS`、`getCompanionStageCopy()`、`formatCompanionLine()`。
- `growth-memory.js`：`currentGrowthMemory()`、`getGrowthMemoryLine()`、`buildWeeklyGrowthMemory()`。
- `formatters.js`：`formatIssueType()`、`formatInternalLabel()`、`formatSourceLabel()`、`formatRouteStage()`。

viewModel 规则：

- 页面以后只消费 viewModel，不直接拼 storage 原始对象。
- 页面不得直接展示 enum/source/stage/routeStatus。
- 所有用户可见文案必须经过 formatter 或 viewModel。
- 老师人格只在 companion voice layer。
- 成长记忆只输出人话，不输出 dashboard。
- profile 只输出家长 5 秒复盘，不输出管理报告。
- 旧模块通过 `legacy/advanced` 字段下沉，不进入首屏 viewModel。

## 六、P0 / P1 / P2 问题清单

### P0：影响真实试用主路径

1. profile 首屏家长复盘与旧 report/share/game/commercial 数据共存，真机上容易再次把主线淹没。
2. 页面直接依赖 `todayFocus.repairStatus`、`todayFocus.issueType`、`reviewCard.source` 等原始状态，后续任何字段变化都可能让用户可见文案失控。
3. `miniActionText/sourceText` 暂未同步到 `appendSyncMutation('today_focus')`，跨设备或服务端家长复盘会断证据链。当前 RC1.5 是本地闭环，因此不是本地试用 P0，但会是云端化 P0。

### P1：不阻塞试用，但会显乱或不可信

1. `storage.js` 同时承担 storage adapter、core logic、formatter、companion voice、growth memory，修改成本高。
2. review 页面同时包含错题闭环、完整复习牌组、quiz、deck 管理、导入等逻辑，主线和后台能力混杂。
3. tools 页面仍像 arcade/content factory/review hub 混合体，知识游乐场的主问题不够纯。
4. home 页面仍构建 dashboard/cockpit/benchmark/proofStats 等历史模块，虽不一定首屏展示，但会提高维护风险。
5. 测试里仍有旧产品断言，例如 shareable identity card、benchmark 等，未来重构时会和 RC2 主线冲突。

### P2：后续技术债

1. 缺少 viewModel 层，WXML 判断过多。
2. 缺少统一 truncation/sanitization policy，`sourceText`、`miniActionText` 在多处直接引用。
3. reviewCards 同时承载今日回访卡、导入卡、游戏卡、benchmark summary，领域边界不清。
4. docs 中仍有旧定位材料，容易让后续 prompt 把产品带回 dashboard/老师分工。
5. 多个模块命名仍偏工程/游戏/增长，如 `factory`、`arena`、`commercialUnlock`、`dataFlywheel`。

## 七、下一轮最小改动建议

不超过 5 项：

1. 先建 `view-models/profile-view-model.js`，只输出：route pill、companion line、今天卡在哪、家长只问一句、明天怎么回访、primary CTA；profile 页面首屏只消费这个 viewModel。
2. 建 `core/formatters.js`，把 `formatIssueType / formatInternalLabel / formatSourceLabel / formatRouteStage` 从 `storage.js` 抽出并保持导出兼容。
3. 建 `core/repair-evidence.js`，抽出 `isValidMiniActionText()` 和 mini action 状态判断；保住 RC1.5 证据流测试。
4. 在 profile 中把 `wrongCauseSummary / gameProfileCard / dailyShareCard / commercialUnlockCard / dataFlywheel / benchmarkPosition` 统一放入 `legacyAdvanced`，默认不进入首屏 viewModel。
5. 增加一条架构测试：四个主 Tab 首屏 WXML 不直接展示 `issueType/source/routeStatus/stage`，只能展示 viewModel 字段或 formatter 结果。

## 八、验证建议

本轮审计后仍需运行：

```powershell
npm.cmd test
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1
```

本轮不应因审计文档改变业务行为。
