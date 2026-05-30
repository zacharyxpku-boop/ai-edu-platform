# 原点智学 UI 参考落地审计

日期：2026-05-31

目标：基于 `C:\Users\86136\Desktop\小程序` 的 HTML/PNG 资产库，持续替换小程序和官网旧 UI，优先保证小程序入口、子界面、跳转和视觉资产一致。

## 当前结论

- 小程序优先级最高，当前活跃页面已经只保留 8 个页面目录：`home`、`upload`、`entry-detail`、`tutor`、`review`、`arcade`、`profile`、`legal`。
- 旧页面入口已经不再直接打开：`daily-math`、`dictation`、`light-diagnosis`、`focus`、`tools`、`module`、`radar`、`diagnosis`。
- 本轮已清理活跃页面 WXSS 里的旧 UI class 残留：`daily-return-*`、`module-flow-*`、`light-entry-*`、`family-summary-*`、`family-diagnosis-*`、`diagnosis-*`、`teacher-*`、`daily-share-*`、`focus-cabin-link`、`light-evidence-card`、`module-flow-mini-*`。
- 防回归已经进入 `scripts/test-miniapp-tab-layout-contract.cjs`，后续这些旧 class 不能重新出现在活跃页面 WXML/WXSS 中。
- `entry-detail` 子界面中部证据卡已从数字卡改为参考图资产卡，避免子页退回“方框 + 数字 + 文字”的旧结构。
- 5 个主 tab 的 `subcheck` 子流程跳转区已从纯文字侧卡改成“参考图 icon + 两行说明”的视觉卡，降低首屏下方空白和文档感。

## 参考资产处理

可直接使用的资产已经复制到：

- `miniprogram/assets/reference/`
- `apps/web/assets/reference/`

当前直接使用资产：

- `brand-house.png`
- `entry-upload.png`
- `entry-report.png`
- `entry-tutor.png`
- `entry-review.png`
- `entry-parent.png`
- `entry-map.png`
- `hero-mascot.png`
- `gudian-sticker.png`

这些资产适合做入口卡、导航图标、路线节点、报告预览、家长证据卡，不需要重新生成。

## HTML 参考如何使用

`C:\Users\86136\Desktop\小程序` 下的 HTML 只能作为结构和视觉参考，不直接复制进小程序或官网。

- 小程序必须继续用 WXML/WXSS/JS 实现。
- 官网必须继续在 `apps/web/` 内实现。
- 未来 App 只复用内容契约和设计 token，不复制小程序或 Web 代码。

## 还建议用 Image2 补的资产

优先级从高到低：

1. `gudian-fullbody-transparent.png`：首页欢迎、子页引导、空状态需要更完整的咕点形象。
2. `report-radar-card-illustration.png`：报告页和家长页需要更高级的报告视觉，不只靠 CSS 雷达。
3. `review-world-map-transparent.png`：复习/游戏页需要更强的游戏地图感。
4. `upload-folder-stack-transparent.png`：上传页分类材料入口需要更强的资料收纳视觉。
5. `tutor-socratic-board-transparent.png`：原小点页面需要更清楚表达“追问第一步”的思考板。
6. `family-avatar-group-transparent.png`：家长中心需要更温和的家庭协同视觉。
7. `learning-route-map-transparent.png`：首页和学习地图需要完整闭环路线图。

生成 prompt 见 `docs/IMAGE2_ASSET_PROMPTS.md`。生成后保持同名放入 `miniprogram/assets/reference/` 和 `apps/web/assets/reference/`。

## 当前验证证据

- `npm.cmd run miniapp:wxml-compile`
- `node scripts/test-current-ui-first-screen.cjs`
- `node scripts/test-miniapp-tab-layout-contract.cjs`
- `npm.cmd run miniapp:five-entry-walkthrough`
- `npm.cmd test`
- `npm.cmd run web:check`

## 下一步最值得做

1. 用真机或开发者工具截图复核小程序 5 个主入口和 5 个 `entry-detail` 子界面。
2. 如果 Image2 资产补齐，优先替换报告页、复习地图页、原小点页的 CSS 临时视觉。
3. 官网下一轮重点不是再做长页面，而是按 `home / upload / report / tutor / review / parent / map` 做页面级截图对照，逐页逼近参考图。
