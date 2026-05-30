# Miniapp Surface

这是微信小程序生产面。

## 边界

- 保留 `miniprogram/` 目录，不移动到 `apps/`。
- 小程序页面继续使用 WXML/WXSS/微信页面生命周期。
- 小程序可以逐步调用 `packages/edu-core/` 和 `packages/ui-contracts/` 的纯业务能力。

## 禁止

- 不从这里直接引用 `apps/web/` 或 `apps/app/` 页面。
- 不把 Web DOM 逻辑带入小程序。
- 不让 App 壳代码进入小程序。

小程序同步到独立仓库仍通过：

```bash
npm run miniapp:sync:aiedumini
```
