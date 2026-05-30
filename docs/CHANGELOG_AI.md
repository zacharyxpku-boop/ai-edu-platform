# AI Changelog

## 2026-05-12

### Completed

- 完成 RC2 Foundation Rebuild 的桌面端收口阶段。
- 新增并接入 `profileViewModel`，让我的页首屏聚焦“家长 5 秒复盘”。
- 新增并接入 `reviewViewModel`，让错题闭环首屏聚焦“今晚只修一个卡点”。
- 新增并接入 `revisitViewModel`，让知识游乐场首屏聚焦“今天回访一小步”。
- 保留旧模块但下沉 / 隔离，不再让 profile/review/tools 首屏直接消费旧 dashboard / raw storage 文案。
- 更新静态测试，让 WXML 检查 viewModel 绑定，让用户可见文案检查 viewModel 文件。
- 新增 `scripts/test-revisit-view-model.cjs`，并加入 `npm test`。
- 创建桌面端到 CLI 交接文档。

### Verification

- `npm.cmd test` passed.
- `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1` passed.

### Residual Risks

- 当前 AppID 仍为 `touristappid`，上传 / 提审前必须配置真实 AppID。
- 工作树包含大量历史脏改动和 untracked 文件，后续不要随意 revert 或 cleanup。
- home 页还没有完成 viewModel 收口。
- profile/tools legacy 区仍存在旧模块，虽然已下沉，但未来仍需防止重新污染首屏。
