# Desktop to CLI Handoff

## 1. 本 session 的原始目标

本轮桌面端任务的核心目标是停止继续堆 UI 和功能，把当前微信小程序从“页面直接混写产品能力、老师人格、成长记忆和家长复盘”推进到 RC2 Foundation Rebuild 的架构收口阶段。

主线保持不变：

学校给全班同一份任务，原点私教给每个孩子一条自己的晚间学习路线；孩子今天选择谁，谁就陪他把这条路线走完。

路线是：

排顺序 -> 说第一步 -> 修卡点 -> 轻回访 -> 整理给家长看

桌面端重点解决：

- profile 首屏从旧 dashboard / 报告墙风险中收口为“家长 5 秒复盘”。
- review 首屏从页面直接读取原始状态，改为消费 reviewViewModel。
- tools 首屏从 WXML 静态文案和 raw reviewCard 读取，改为消费 toolsViewModel。
- 保持 miniActionText / reviewCard / companionPreference / tutor ladder 等核心学习状态流不变。

## 2. 已完成内容

- 完成 RC2 架构审计文档，明确页面层、状态层、viewModel 层的边界。
- 新增 profileViewModel，让“我的页”首屏只输出家长 5 秒复盘所需内容。
- profile 首屏改为绑定 profileViewModel，旧模块保留但下沉 / legacy 化，不再污染首屏。
- 新增 reviewViewModel，让“错题闭环”首屏只输出修一个卡点所需内容。
- review 首屏改为绑定 reviewViewModel，修复证据流仍保留在原页面逻辑中。
- 新增 toolsViewModel，让“知识游乐场 / 轻回访”首屏只输出轻回访所需内容。
- tools 首屏改为绑定 toolsViewModel，玩法和材料生成仍保留在首屏之后。
- 新增并接入 profile / review / tools viewModel 相关测试。
- 更新旧静态测试：WXML 检查 viewModel 绑定，用户可见文案检查 viewModel 文件。
- 已运行完整测试和仓库验证，均通过。

## 3. 修改文件列表

本节列出本次桌面端 RC2 收口直接相关的文件。当前工作树还存在更早轮次留下的大量脏改动，CLI 接管时不要误认为这些都属于下一轮要继续处理的范围。

### 新增 / 更新的 viewModel

- `miniprogram/view-models/profile-view-model.js`
  - profile 首屏用户可见输出层。
  - 汇总 companionPreference、todayFocus、miniActionText、reviewCard、growthMemory，输出安全中文文案。

- `miniprogram/view-models/review-view-model.js`
  - review 首屏用户可见输出层。
  - 输出路线 pill、老师陪伴语气、主标题、主卡、主 CTA、空态和下一步。

- `miniprogram/view-models/tools-view-model.js`
  - tools 首屏用户可见输出层。
  - 输出轻回访路线 pill、老师陪伴语气、回访卡 / 试玩空态、主 CTA、去我的页下一步。

### 页面接入

- `miniprogram/pages/profile/profile.js`
  - 构建并注入 profileViewModel。

- `miniprogram/pages/profile/profile.wxml`
  - 首屏绑定 profileViewModel，不直接展示 raw todayFocus / raw issueType / old dashboard modules。

- `miniprogram/pages/review/review.js`
  - 构建并注入 reviewViewModel。

- `miniprogram/pages/review/review.wxml`
  - 首屏绑定 reviewViewModel。
  - miniActionText 证据流区域保持原逻辑。

- `miniprogram/pages/entry-detail/entry-detail.js`
  - 引入 buildToolsViewModel。
  - 根据 companionPreference 和 today-focus review cards 构建 toolsViewModel。

- `miniprogram/pages/entry-detail/entry-detail.wxml`
  - 首屏绑定 toolsViewModel。
  - 旧玩法、材料输入、小游戏入口仍在首屏之后或折叠区域。

### 测试

- `scripts/test-profile-view-model.cjs`
  - 覆盖 profileViewModel 输出、miniActionText 家长问题、growth memory 规则、安全文案。

- `scripts/test-review-view-model.cjs`
  - 覆盖 reviewViewModel 输出、空态、修复 CTA、完成态。

- `scripts/test-tools-view-model.cjs`
  - 覆盖 toolsViewModel 输出、回访卡态、试玩空态、nextStep、安全文案、WXML 绑定。

- `scripts/test-rc14-ui-first-screen.cjs`
  - 更新为允许 profile/review/tools 文案来自 viewModel。

- `scripts/test-rc12-ui-reduction.cjs`
  - 更新 tools/profile/review 静态断言来源。

- `scripts/test-rc1-companion-polish.cjs`
  - 更新四个 Tab companion strip 统计，纳入 toolsViewModel。

- `scripts/test-rc11-first-day.cjs`
  - 更新 tools 首日空态 / 下一步 / CTA 的断言来源。

- `scripts/test-rc13-nova-system-alignment.cjs`
  - 更新 tools 轻回访主线断言来源。

- `scripts/test-tonight-route.cjs`
  - 更新 tools 轻回访和 route CTA 的断言来源。

- `scripts/test-rc06-ui.cjs`
  - 更新 tools route pill / recall entry 的断言来源。

- `scripts/test-companion-preference.cjs`
  - 更新 tools companion strip 断言来源。

- `scripts/test-review-engine.cjs`
  - 更新 tools CTA / recall entry 的断言来源。

- `package.json`
  - 将 `scripts/test-tools-view-model.cjs` 加入 `npm test`。
  - 新增 `test:tools-view-model` 脚本。

### 文档

- `docs/rc2-architecture-audit.md`
  - RC2 架构审计。

- `docs/rc2-profile-view-model-report.md`
  - profileViewModel 收口报告。

- `docs/HANDOFF_DESKTOP_TO_CLI.md`
  - 当前桌面端到 CLI 的交接文档。

- `docs/TODO.md`
  - 当前精简任务队列。

- `docs/CHANGELOG_AI.md`
  - AI 修改记录。

## 4. 当前验证结果

已运行：

```powershell
npm.cmd test
```

结果：通过。

已运行：

```powershell
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1
```

结果：通过。

非致命 warning：

- Upload gate 显示当前 AppID 仍为 `touristappid`。
- 上传 / 提审前必须运行 `npm run miniapp:appid -- wx你的AppID` 配置真实 AppID。
- verify 输出中存在大量 CRLF 提示，这是 Git 行尾提示，不是测试失败。

## 5. 当前仍存在的问题

- 当前工作树很脏，包含多轮历史改动和大量 untracked 文件。CLI 接管后不要做大范围 cleanup，也不要 revert 用户或历史生成内容。
- profile / review / tools 已经有 viewModel，但 home 还没有完成同等收口。
- profile legacy 区仍保留旧模块，只是首屏隔离；未来仍有被重新拉回 dashboard / 报告墙的风险。
- tools 页首屏已收口，但页面文件中仍存在较多玩法、材料生成、学习资产相关逻辑，属于后续 P1/P2 技术债。
- 真实 AppID 未配置，无法直接上传体验版。

## 6. 下一步最优先任务

- P0：停止扩展范围，先让 CLI 确认当前 `npm test` 和 `scripts/verify.ps1` 仍通过。
- P1：做 home-view-model 收口方案，但只在明确要求时实施。
- P1：继续隔离 profile/tools legacy 模块，避免首屏被旧 dashboard 文案污染。

## 7. 禁止后续扩大范围

CLI 接管后不要做以下事情：

- 不要重构无关模块。
- 不要改动核心学习状态流：tonightPlan、todayFocus、miniActionText、reviewCard、tutor ladder、companionPreference。
- 不要新增无关 UI。
- 不要继续修 UI 视觉风格。
- 不要新增老师、Tab、排行榜、支付、商业解锁、老师端。
- 不要引入新依赖。
- 不要改后端 API。
- 不要做拍照搜题、OCR、PDF、PPT 导入。
- 不要删除旧模块，除非用户单独明确授权。
- 不要把 legacy 模块重新放回 profile/review/tools 首屏。

## 8. CLI 接管建议

CLI 启动后建议优先阅读：

1. `AGENTS.md`
2. `docs/HANDOFF_DESKTOP_TO_CLI.md`
3. `docs/TODO.md`
4. `docs/CHANGELOG_AI.md`
5. `docs/rc2-architecture-audit.md`
6. `docs/rc2-profile-view-model-report.md`
7. `scripts/verify.ps1`
8. `package.json`
9. `miniprogram/view-models/profile-view-model.js`
10. `miniprogram/view-models/review-view-model.js`
11. `miniprogram/view-models/tools-view-model.js`

如果存在 `docs/AI_CONTEXT.md`，也可以阅读；当前本次交接未依赖该文件。

## 9. 推荐 CLI 模式

推荐下一轮使用：Daily Dev。

原因：

- 当前不需要继续大规模自主推进。
- 测试和 verify 已通过，下一步最重要的是稳定接管、确认状态、避免扩大范围。
- Goal Mode / Auto Loop 容易把任务继续扩成 home viewModel 或更多重构，不适合当前“停止开发、交接优先”的阶段。
- Deep Engineering 仅在用户明确要求继续做 RC2 架构收口时再使用。
