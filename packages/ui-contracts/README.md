# UI Contracts

三端共享页面数据契约。

这里描述“页面需要什么数据”，不描述“页面怎么画”。

## 可以放

- 五入口页面 view model schema。
- 报告页 section schema。
- 私教/复习/家长页的状态结构。
- 跨端 fixture 和 mock 数据。

## 不可以放

- 小程序组件。
- Web 组件。
- App 组件。
- 端相关 API。

## 当前契约

- `web-surface-contract.cjs`: 官网 Web 原型的入口、闭环步骤和 view-model 字段契约。它只描述“页面需要哪些数据”和“闭环如何流转”，不包含任何 Web DOM、WXML/WXSS 或 App 壳代码。

`apps/web/scripts/check-web-surface.cjs` 会读取这个契约，保证官网 Web 的六个入口、闭环步骤和基础 view-model 字段没有漂移。
