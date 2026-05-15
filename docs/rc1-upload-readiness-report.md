# RC1 体验版上传前报告

生成日期：2026-05-11

## 1. AppID 状态

检查文件：

- `miniprogram/project.config.json`
- `miniprogram/project.private.config.json`

当前结论：

- `miniprogram/project.config.json` 中 `appid` 仍为 `touristappid`。
- `miniprogram/project.private.config.json` 当前没有覆盖真实 `appid`。
- 当前无法上传真实体验版。

必须先运行：

```powershell
npm.cmd run miniapp:appid -- wx你的真实AppID
```

不要自行编造 AppID；以微信公众平台后台实际 AppID 为准。

## 2. 是否仍为 touristappid

是。

当前仍是游客 AppID。代码和本地验证可以继续，但真实体验版上传会被阻塞。

## 3. 是否需要配置真实 AppID

需要。

配置真实 AppID 后，建议重新运行：

```powershell
npm.cmd run miniapp:fullcheck
npm.cmd test
```

然后再用微信开发者工具导入 `miniprogram/` 进行真机预览。

## 4. 需要配置的合法域名

小程序侧实际网络请求：

- `wx.request`：存在，集中在 `miniprogram/utils/api.js`
- `wx.uploadFile`：未发现
- `wx.downloadFile`：未发现
- `wx.connectSocket`：未发现

微信公众平台后台配置清单：

| 类型 | 域名 | 状态 |
| --- | --- | --- |
| request 合法域名 | `https://yuandianzhixue.com` | 需要配置 |
| uploadFile 合法域名 | 无 | 首版不配置 |
| downloadFile 合法域名 | 无 | 首版不配置 |
| websocket 合法域名 | 无 | 首版不配置 |

说明：

- 当前页面主流程主要依赖本地状态和本地 mock，可完成本地体验验证。
- 已接入的正式 API 会请求 `https://yuandianzhixue.com/api/...`。
- 后端内部访问 Supabase、DeepSeek、DashScope、微信接口或邮件服务，不属于小程序后台直接配置的合法域名，除非未来小程序端直接请求这些域名。

## 5. npm.cmd test

结果：通过。

本轮运行命令：

```powershell
npm.cmd test
```

覆盖：

- tonightPlan
- todayFocus
- reviewCard
- tutor ladder
- import intake
- review engine
- companionPreference
- growth memory
- miniapp encoding
- positioning copy
- production rules

## 6. scripts/verify.ps1

结果：通过，退出码 0。

本轮运行命令：

```powershell
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1
```

注意：verify 中 Upload Gate 为非致命阻塞，原因是当前 AppID 仍为 `touristappid`。

## 7. 是否可以上传体验版

当前不可以。

阻塞原因：

1. 当前 AppID 仍为 `touristappid`。
2. `project.private.config.json` 未覆盖真实 AppID。
3. 仍需微信后台配置 request 合法域名：`https://yuandianzhixue.com`。
4. 仍需微信开发者工具导入和人工真机预览。

代码和本地验证已准备好，但真实体验版仍需配置 AppID 并人工真机验收。

## 8. 仍需人工真机确认

上传体验版前必须人工确认：

- 作业点拨默认态。
- 错题闭环默认态。
- 知识游乐场默认态。
- 我的页默认态。
- “今天想让谁陪你？”轻入口。
- 老师选择展开态。
- 选择安安、问问、跃跃后的跨 Tab 文案跟随。
- 四个 Tab 主 CTA 不变。
- 底部 Tab 不遮挡内容。
- 顶部不撞微信胶囊区。
- 求答案仍然被拦截。
- 不出现“秒解”“拍照出答案”“答案已生成”。
- 不出现“数学老师 / 英语老师 / 语文老师 / 科学老师”。
- 不出现“小满”。

## 9. 是否建议进入 3 户内部家庭冒烟试用

建议顺序：

1. 先配置真实 AppID。
2. 完成 request 合法域名配置。
3. 微信开发者工具导入 `miniprogram/`。
4. 完成真机默认态和老师选择机制截图验收。
5. 上传体验版并生成体验二维码。
6. 进入 3 户内部家庭冒烟试用。

当前可以准备 3 户试用材料，但不建议分发体验版，因为真实 AppID 和真机验收尚未完成。
