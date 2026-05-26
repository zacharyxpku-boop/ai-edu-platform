# App Surface

App 端先作为轻量壳承接成熟 Web 流程，避免同时维护三套 UI。

## 第一阶段

- 优先 WebView / Capacitor / 轻壳方案。
- 复用 `apps/web/` 已验证的网页体验。
- 只在这里处理 App 壳、权限、登录、推送和系统能力适配。

## 不可以做

- 直接复制小程序 WXML/WXSS。
- 让 App 壳代码进入 `miniprogram/`。
- 在共享业务包里写 App 原生 API。

App 推 App，小程序推小程序，网页推网页。
