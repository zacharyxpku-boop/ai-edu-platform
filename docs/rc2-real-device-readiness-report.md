# RC2 Real Device Readiness Report

## 1. AppID Status

Current `miniprogram/project.config.json` still uses:

```json
"appid": "touristappid"
```

`miniprogram/project.private.config.json` exists, but it does not override a real AppID.

Result: current project cannot upload an experience version yet.

Before upload, run:

```powershell
npm.cmd run miniapp:appid -- wx你的真实AppID
```

Do not invent an AppID. Use the real AppID from WeChat Official Accounts Platform / Mini Program backend.

## 2. Upload Readiness

Code and local verification are ready for the RC2 flow, but upload remains blocked by the non-code AppID gate.

Current status:
- Local miniapp checks: pass
- Test suite: pass
- Upload gate: blocked until real AppID is configured

## 3. WeChat Legal Domains

Miniapp request path:
- `miniprogram/app.js`: `apiBase = https://yuandianzhixue.com`
- `miniprogram/utils/api.js`: `DEFAULT_BASE_URL = https://yuandianzhixue.com`
- API calls use `wx.request`

Required WeChat backend domain:

| Type | Domain | Status |
| --- | --- | --- |
| request 合法域名 | `https://yuandianzhixue.com` | Must configure before real experience version |
| uploadFile 合法域名 | none for RC2 main flow | No miniapp-side `wx.uploadFile` found |
| downloadFile 合法域名 | none for RC2 main flow | No miniapp-side `wx.downloadFile` found |
| websocket 合法域名 | none for RC2 main flow | No miniapp-side `wx.connectSocket` found |

RC2 main route can run mostly on local state, but formal API requests still require the request legal domain.

## 4. Screenshot Checklist

Created:

- `docs/rc2-real-device-screenshot-checklist.md`

It covers:
- Home default
- Home teacher picker expanded
- Review empty
- Review in progress
- Tools without reviewCard
- Tools with reviewCard
- Profile default
- Four tabs after selecting An An
- Four tabs after selecting Wen Wen
- Tools / Profile after selecting Yue Yue

## 5. Full Real Device Path

The full RC2 path is written into `docs/rc2-real-device-screenshot-checklist.md`:

选老师 -> 粘贴作业 -> 安排路线 -> 输入卡点 -> 生成 `todayFocus` -> 输入 `miniActionText` -> 完成修复 -> 生成 `reviewCard` -> Tools 读取回访卡 -> Profile 读取 `miniActionText` 并生成家长只问一句。

It also includes the answer-request block check: input "直接告诉我答案" and confirm the tutor ladder still blocks direct answers.

## 6. Internal Key / Forbidden Copy Scan

Checked source with `rg`.

Findings:
- `home_xiaodian_entry` and `needs_student_step` still exist as internal keys and formatter test fixtures.
- `拍照出答案` / `答案已生成` appear in blocking regexes and tests that ensure answer-tool wording is rejected.
- No evidence from this check that these keys are exposed through the four Tab first-screen viewModel path.

Existing tests continue to guard:
- no user-visible raw key in first screens
- no dashboard copy in first screens
- no teacher division copy in first screens

## 7. Dashboard / Teacher Division Residual

Four main Tab first screens remain viewModel-driven:
- Home: `homeViewModel`
- Review: `reviewViewModel`
- Tools: `revisitViewModel`
- Profile: `profileViewModel`

No first-screen dashboard, teacher division, or report-wall module was found in the RC2 first-screen path. Legacy modules still exist below the fold / advanced areas, as expected for RC2.

## 8. First-Screen Structure

Current first-screen structure still matches:

- one route pill
- one companion strip
- one main question
- one primary card / input card
- one main CTA
- at most one light secondary action or next step

Specific guards:
- `scripts/test-rc14-ui-first-screen.cjs`
- `scripts/test-rc2-first-screen-unification.cjs`

## 9. Small Fixes This Round

No new feature was added.

No product-line or state-flow change was made.

No P0 code fix was required in this round. This round produced readiness documentation and configuration findings only.

## 10. Verification

To be run at the end of this round:

```powershell
npm.cmd test
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1
```

Expected known non-code gate:
- Upload-ready gate remains blocked until real AppID replaces `touristappid`.

## 11. Recommendation

Recommended next step:

1. Configure the real AppID.
2. Configure request legal domain `https://yuandianzhixue.com` in WeChat backend.
3. Re-run:

```powershell
npm.cmd run miniapp:fullcheck
npm.cmd test
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1
```

4. Open WeChat DevTools and run the screenshot checklist on a real device.
