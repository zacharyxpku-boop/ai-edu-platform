# 产品端边界

目标：同一套教育产品能力，分别稳定交付小程序、网页和 App，不让三端代码互相污染。

## 当前结论

- `miniprogram/` 是微信小程序生产面，继续保留原位，不移动、不改成跨端框架。
- `apps/web/` 是网页产品面，后续网页只在这里起页面、路由和 Web UI。
- `apps/app/` 是轻量 App 产品面，第一阶段优先承接 WebView/Capacitor 壳，不直接复制小程序页面。
- `packages/edu-core/` 是三端共享业务内核，只放纯业务逻辑。
- `packages/ui-contracts/` 是三端共享页面数据契约，只放 view model、schema、fixture，不放具体 UI。

## 允许共享的内容

- 材料分类和上传 intake SOP。
- 个性化报告生成、报告证据协议、PDF/HTML 导出规则。
- AI 私教边界、苏格拉底追问策略、禁止代写规则。
- 复习、回忆、迁移、家长下一步的业务状态机。
- 竞品参考沉淀后的交互原则和页面数据结构。

## 不允许共享的内容

- 小程序 `WXML/WXSS` 不进入网页或 App。
- Web React/Vue/HTML 组件不进入 `miniprogram/`。
- App 壳代码不进入小程序。
- 三端不能互相 `require` 或 `import` 对方的页面文件。
- 共享包不能依赖 `wx`、DOM、浏览器全局对象或 App 原生 API。

## 推进顺序

1. 小程序继续以 `miniprogram/` 为上线主线。
2. 网页先在 `apps/web/` 做 H5/PWA 首版，复用 `packages/edu-core/` 输出。
3. App 先在 `apps/app/` 做轻壳，直接承接网页成熟页面。
4. 每次抽共享逻辑，先写到 `packages/edu-core/` 或 `packages/ui-contracts/`，再由三端 adapter 调用。

## 验证

运行：

```bash
npm run check:boundaries
```

该脚本会阻止网页/App 直接引用小程序页面，也会阻止共享包依赖具体端。
