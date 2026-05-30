# RC2 First Screen Unification Report

## Scope

本轮没有新增功能，没有改后端 API，也没有改核心学习状态流。改动只围绕四个主 Tab 的首屏验收：确认每页都由对应 viewModel 提供首屏主文案，并保持一个主问题、一个当前陪伴老师、一张主任务卡、一个主 CTA。

## 四个 Tab 首屏保留内容

### Home

作业点拨只回答“今晚从哪一步开始？”

首屏保留：
- `homeViewModel.routePill`
- `homeViewModel.companionStrip`
- `homeViewModel.title`
- `homeViewModel.subtitle`
- `homeViewModel.inputCard`
- `homeViewModel.primaryCta`
- `homeViewModel.secondaryAction`
- `homeViewModel.teacherPickerHint`

轻微收口：当 `homeViewModel.nextStep` 出现时，不再同时显示 secondary action，避免一个首屏出现两个下一步入口。

### Review

错题闭环只回答“今晚只修一个卡点”。

首屏保留：
- `reviewViewModel.routePill`
- `reviewViewModel.companionStrip`
- `reviewViewModel.title`
- `reviewViewModel.subtitle`
- `reviewViewModel.primaryCard.sections`
- `reviewViewModel.primaryCta`
- `reviewViewModel.miniAction`，仅在修复中且尚未保存第一步证据时出现

轻微收口：miniAction 输入区由 `reviewViewModel.miniAction` 控制，避免首屏直接用 raw `todayFocus.repairStatus` 判断展示。

### Tools

知识游乐场只回答“今天回访一小步”。

首屏保留：
- `revisitViewModel.routePill`
- `revisitViewModel.companionStrip`
- `revisitViewModel.title`
- `revisitViewModel.subtitle`
- `revisitViewModel.primaryCard`
- `revisitViewModel.primaryCta`

轻微收口：补充了首屏 subtitle 绑定，玩法区继续折叠在首屏之后。

### Profile

我的页只回答“今晚家长只问哪一句”。

首屏保留：
- `profileViewModel.routePill`
- `profileViewModel.companionStrip`
- `profileViewModel.title`
- `profileViewModel.subtitle`
- `profileViewModel.primaryCard.sections`
- `profileViewModel.primaryCta`
- `profileViewModel.nextStep`

旧的家长报告、成长卡、分享、商业入口、统计类模块继续下沉到首屏之后或 advanced 区域。

## 下沉或折叠的模块

- Home：成长记忆长句、多余路线解释、raw focus/source/issueType、多个 nextStep、dashboard 式信息。
- Review：错题本管理、进度轨、统计、复习闯关、旧弱点卡、错误类型模块。
- Tools：四个玩法、想练自己的内容、材料输入、认知分类说明。
- Profile：`wrongCauseSummary`、`dailyShareCard`、`gameProfileCard`、`commercialUnlockCard`、`dataFlywheel`、`benchmarkPosition`、`parentReport`、`proofScore`、学习战绩、成长卡、商业解锁入口。

## Dashboard / 报告墙风险

首屏风险已降低。Profile 首屏不再直接展示 legacy 报告墙字段；Tools 首屏不展示玩法宫格；Review 首屏不展示统计或错误类型分布。残余风险仍在首屏之后的 legacy 区域，后续如继续 RC2，可考虑单独建立 legacy viewModel 或按产品判断删除。

## Raw Key 风险

四个首屏均绑定对应 viewModel；新增 `scripts/test-rc2-first-screen-unification.cjs` 检查首屏不直接绑定 `issueType`、`sourceText`、`routeStatus`、`companionLine`、`companionCopy`、`growthMemory` 等 raw 字段。旧字段仍可作为兼容逻辑存在，但不作为首屏文案源。

## 小屏风险

本轮只做轻量收口：
- Home 避免 nextStep 和 secondaryAction 同屏抢行动；
- Tools 补充短 subtitle，保持玩法区折叠；
- Review 把 miniAction 输入纳入首屏主流程，但仍只有一个主 CTA；
- Profile 首屏继续只保留 5 秒复盘主卡。

未做大 UI 重构。仍建议进入真机截图验收，重点看小屏上 Review 输入区与主 CTA 是否被底部 Tab 遮挡。

## Verification Guard

新增测试：
- `scripts/test-rc2-first-screen-unification.cjs`

该测试已加入 `npm.cmd test`，用于防止四个首屏重新绕过 viewModel 或回到 dashboard/老师分工/内部 key 展示。
