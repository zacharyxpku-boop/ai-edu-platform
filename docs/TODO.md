# TODO

## Done

- [x] RC2 architecture audit completed in `docs/rc2-architecture-audit.md`.
- [x] profile first screen routed through `profileViewModel`.
- [x] review first screen routed through `reviewViewModel`.
- [x] tools first screen routed through `toolsViewModel`.
- [x] profile / review / tools viewModel tests added and included in `npm test`.
- [x] `npm.cmd test` passed.
- [x] `scripts/verify.ps1` passed.
- [x] RC5 产品状态评估与体验壳层收口计划写入 `docs/rc5-product-state-and-plan.md`。
- [x] RC5 首轮收口：Tab / 页头 / Review 完成跳转从旧玩法语气改为路线语气。
- [x] 新增 `scripts/test-rc5-product-shell.cjs`，防止首屏壳层回到“知识游乐场 / 错题闭环 / 报告墙”。

## Next

- [ ] P0: 配置真实微信 AppID 前，不要上传体验版。
- [ ] P1: 继续隔离 profile/tools legacy 模块，避免游戏档案 / 报告墙 / 商业验证回到首屏。
- [ ] P1: 真机截图前确认四个 Tab 首屏高度、底部 Tab 遮挡、微信胶囊碰撞和老师 2x3 区域密度。
- [ ] P2: 梳理当前脏工作树，把历史改动和本轮架构收口分批提交或归档。
