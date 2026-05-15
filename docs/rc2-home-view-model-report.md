# RC2 Home ViewModel Report

## Scope

本轮没有新增功能，没有改 UI 主结构，也没有改后端 API。改动只围绕作业点拨首页首屏收口：让首页首屏从 `homeViewModel` 读取用户可见内容，不再在 WXML 首屏直接拼 raw storage、enum、source、stage 或 companion 文案。

## homeViewModel 输入

`miniprogram/view-models/home-view-model.js` 的 `buildHomeViewModel()` 接收：

- `companionPreference`
- `tonightPlan`
- `todayFocus`
- `sourceText`
- `growthMemory` / `currentGrowthMemory`

这些输入仍来自现有本地状态。没有改变 `tonightPlan`、`todayFocus`、`reviewCard`、`tutor ladder`、`companionPreference` 或 `miniActionText` 证据流。

## homeViewModel 输出

当前输出包括：

- `routePill`：今晚路线第 1 步
- `companionStrip`：当前老师的一句首页陪伴文案
- `title`：今晚从哪一步开始？
- `subtitle`：作业多先排顺序，卡住先说第一步
- `inputCard`：输入卡标题、placeholder 和 helper
- `primaryCta`：帮我安排今晚学习
- `secondaryAction`：已经卡住了？我来说第一步
- `teacherPickerLabel` / `teacherPickerHint`：轻量老师选择入口说明
- `selectedCompanionLabel`：当前老师名
- `emptyState`：无路线/卡点时的温和空态
- `nextStep`：已有 plan 或 focus 后的下一步提示
- `debugWarnings`：内部检查字段，不作为用户可见展示

用户可见字段都由 viewModel 输出，页面首屏只绑定 `homeViewModel.*`。

## 首页首屏现在展示

首页第一眼保留：

- 1 个路线 pill：`homeViewModel.routePill`
- 1 个 companion strip：`homeViewModel.companionStrip`
- 1 个主标题：`homeViewModel.title`
- 1 个短说明：`homeViewModel.subtitle`
- 1 张输入主卡：`homeViewModel.inputCard`
- 1 个主 CTA：`homeViewModel.primaryCta`
- 1 个次入口：`homeViewModel.secondaryAction`
- 1 个轻量老师选择提示：`homeViewModel.teacherPickerHint`

原有输入、提交、生成 `tonightPlan` / `todayFocus` 的交互逻辑保留。

## 下沉或不再首屏展示

以下内容不再作为首页首屏用户可见文案来源：

- `routeDisplayText`
- raw `companionLine`
- raw `todayFocus`
- raw `issueType`
- raw `sourceText`
- 成长记忆长句
- 多余路线解释
- 老师长介绍
- 卡点详情
- 多个 nextStep
- dashboard 式信息

旧字段如仍存在于页面 data 或逻辑中，仅作为兼容状态或后续模块使用，不作为首屏文案源。

## 信息过载风险

首页首屏信息密度已降低到一个问题、一句陪伴、一张输入卡、一个主 CTA。残余风险主要在首屏之后的旧模块和历史 data 字段较多，后续如果继续迭代，应避免把这些内容重新提升到首屏。

## 下一步建议

建议下一轮做四个 Tab 首屏统一减法验收，而不是继续新增能力。重点确认：

1. 四个 Tab 首屏都只消费各自 viewModel；
2. WXML 首屏不直接展示 raw storage / enum / source / stage；
3. 旧模块继续下沉，不回到 dashboard 或报告墙；
4. `miniActionText`、`reviewCard`、`growthMemory`、`companionPreference` 状态流继续通过测试。
