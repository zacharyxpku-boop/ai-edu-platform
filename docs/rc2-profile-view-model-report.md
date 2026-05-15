# RC2 Profile ViewModel Report

## Scope

本轮没有新增功能，也没有重构四个 Tab。改动只围绕我的页首屏收口：让首屏从一个 `profileViewModel` 读取“家长 5 秒复盘”，把旧模块保留在后续区域，避免重新变成 dashboard 或报告墙。

## profileViewModel 输入

`miniprogram/view-models/profile-view-model.js` 的 `buildProfileViewModel()` 接收：

- `companionPreference`
- `todayFocus`
- `issueType`
- `sourceText`
- `miniActionText` / `miniActionAt`
- `repairStatus`
- `reviewCard` / `reviewCards`
- `growthMemory` / `currentGrowthMemory`
- `reviewEvents`

这些输入仍来自原有本地状态，不改变 storage 结构，不改后端 API，也不改 miniActionText 证据流。

## profileViewModel 输出

当前输出：

- `routePill`：今晚路线第 5 步
- `companionStrip`：当前老师的人话陪伴句
- `title`：今晚家长只问这一句
- `subtitle`：不是看分数，是看孩子今天卡在哪一步
- `primaryCard.sections`：今天卡在哪、孩子说出的第一步、家长只问一句、明天怎么回访
- `primaryCta`：完成今日回访
- `growthMemoryCard`：下沉的人话记忆卡
- `collapsedSections`：旧模块隔离标记
- `emptyState`：无学习小结时的温和空态
- `nextStep`：完成修复后的明天回访提示
- `debugWarnings`：保留给内部检查，不做用户可见展示

用户可见字段均为中文自然表达，不输出 enum、source、stage、snake_case 或 camelCase。

## 我的页首屏

首屏现在只展示：

- 路线 pill
- 当前老师陪伴句
- 标题“今晚家长只问这一句”
- 短说明
- 一张 5 秒复盘主卡
- 一个主 CTA
- 完成后的下一步提示

WXML 首屏不再直接绑定 `todayFocus`、`tonightPlan`、`weeklyGrowthMemory`、`wrongCauseSummary`、`dailyShareCard`、`gameProfileCard`、`commercialUnlockCard`、`dataFlywheel`、`benchmarkPosition`、`parentReport`、`proofScore`。

## 旧模块隔离

以下旧模块保留在首屏之后或其他 panel，不删除：

- `wrongCauseSummary`
- `dailyShareCard`
- `gameProfileCard`
- `commercialUnlockCard`
- `dataFlywheel`
- `benchmarkPosition`
- `parentReport`
- `proofScore`
- `shareRuns`

它们被视为 legacy / advanced 内容，不再参与我的页首屏主卡。后续如果继续 RC2，可以把这些内容进一步收进独立 legacy viewModel 或按产品判断删除。

## Growth Memory

`growthMemoryCard` 只输出人话：

- 只有 1 条记录时：今天记录到
- 2 条以上同类记录时：最近常卡在

不显示百分比、分布图、近 7 天错误类型分布，也不使用系统诊断或家长监督语气。

## Dashboard 风险

首屏 dashboard / 报告墙风险已明显降低。残余风险在首屏之后的 legacy 区域：旧的成长卡、游戏档案、商业解锁和家长报告仍存在代码与模板中，虽然默认不再污染首屏，但下一轮建议继续收口。

## 下一步建议

建议下一轮做 home / review / tools 的 viewModel，同样把页面直接读 storage 的部分收口，优先保护：

1. `todayFocus` 和 `miniActionText` 证据流；
2. `reviewCard` 的具体卡点引用；
3. 四个 Tab 的老师语气一致；
4. 页面不直接展示 enum / key；
5. 旧模块继续隔离而不是扩散。
