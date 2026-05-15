# RC6 AppID Replacement Checklist

## Purpose

Prepare the frozen RC6 local-first MVP for real WeChat AppID replacement after manual DevTools smoke has passed.

Do not upload automatically. Do not change product code. Do not invent or use a placeholder AppID.

## Current Gate

- RC6 local-first MVP is frozen.
- Manual DevTools smoke has passed.
- `miniprogram/project.config.json` still contains `touristappid`.
- Upload-ready must remain blocked until a real WeChat AppID is provided.

## AppID Replacement Path

Command:

```powershell
npm.cmd run miniapp:appid -- wx你的真实AppID
```

What the command does:

- Runs `node scripts/miniapp-launch-assistant.cjs --appid <AppID>`.
- Writes AppID into `miniprogram/project.private.config.json`.
- Preserves existing private config fields with `Object.assign`.
- Adds or updates:
  - `appid`
  - `projectname`
  - `setting.compileHotReLoad`

What the command must not do:

- Must not edit product pages.
- Must not edit app logic.
- Must not edit backend/API code.
- Must not upload.
- Must not replace AppID with a fake value.

Safety checks already present:

- Rejects AppIDs that do not match `wx...`.
- Rejects `touristappid`.
- Rejects placeholder-like values such as `PLACEHOLDER`, `TEST`, `DUMMY`, `FAKE`, `YOUR`, `真实`, `你的`, or `示例`.
- Supports dry-run/check-only flags in the underlying script.

Dry-run option:

```powershell
node scripts/miniapp-launch-assistant.cjs --appid wx你的真实AppID --dry-run
```

Use dry-run first if you want to confirm the target file and generated private config before writing.

## Before Replacement

- [ ] Confirm manual DevTools smoke passed.
- [ ] Confirm no red Console startup/runtime errors remain.
- [ ] Confirm Home renders.
- [ ] Confirm all five tabs render:
  - 作业点拨
  - 专注舱
  - 修卡点
  - 轻回访
  - 我的
- [ ] Confirm focus completion persists and Profile/Tools can read evidence.
- [ ] Run:

```powershell
node scripts/test-miniapp-startup.cjs
node scripts/test-focus-cabin.cjs
npm.cmd test
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1
npm.cmd run miniapp:fullcheck -- --upload-ready
```

Expected before real AppID:

- Startup guard passes.
- Focus cabin test passes.
- Full test suite passes.
- Verify script passes.
- Upload-ready fails only because real AppID is missing.

## Replacement Steps

1. Get the real Mini Program AppID from WeChat Official Accounts Platform.
2. Optional dry-run:

```powershell
node scripts/miniapp-launch-assistant.cjs --appid wx你的真实AppID --dry-run
```

3. Write real AppID:

```powershell
npm.cmd run miniapp:appid -- wx你的真实AppID
```

4. Confirm `miniprogram/project.private.config.json` now contains the real AppID.
5. Do not commit or expose the real AppID unless the team explicitly decides that is acceptable.

## After Replacement

- [ ] Reopen WeChat DevTools.
- [ ] Clear cache and recompile.
- [ ] Confirm Home renders.
- [ ] Confirm bottom tab renders.
- [ ] Rerun manual smoke path:
  - Home
  - Upload/Input
  - Diagnosis
  - Review
  - 专注舱
  - Profile
  - Tools
  - Empty states after clearing local data
- [ ] Confirm Console has no red startup/runtime errors.
- [ ] Rerun:

```powershell
node scripts/test-miniapp-startup.cjs
node scripts/test-focus-cabin.cjs
npm.cmd test
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1
npm.cmd run miniapp:fullcheck -- --upload-ready
```

Expected after real AppID:

- Startup guard passes.
- Focus cabin test passes.
- Full test suite passes.
- Verify script passes.
- Upload-ready passes AppID gate.

## Only Then Consider Upload

Only consider preview / experience version upload after:

- Real AppID is configured.
- DevTools recompiles cleanly.
- Manual smoke passes again.
- Upload-ready passes.
- Request legal domain is configured in WeChat backend:

```text
https://yuandianzhixue.com
```

## Do Not Proceed If

- Home blank screen returns.
- Any tab first screen fails to render.
- Any primary CTA is dead.
- Focus session completion does not persist.
- Profile cannot read focus recap.
- Tools cannot read revisit evidence.
- Console shows red startup/runtime errors.
- Upload-ready fails for anything other than AppID before replacement.
- AppID value is not a real `wx...` Mini Program AppID from WeChat.

## Replacement Record

Date:

Operator:

Manual smoke before replacement:

Dry-run result:

Real AppID command run:

DevTools version:

Simulator device:

Manual smoke after replacement:

Upload-ready result:

Decision:

- [ ] Ready for preview / experience upload
- [ ] Not ready; blocker remains

