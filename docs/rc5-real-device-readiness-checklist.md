# RC5 Real-Device Readiness Checklist

## Scope

This checklist is for the first real AppID replacement, WeChat DevTools import, real-device preview, and experience-version upload check. Do not add features during this pass; only record P0/P1 display or flow blockers.

Current upload blocker: `miniprogram/project.config.json` still uses `touristappid`. Do not upload until a real AppID is configured through `npm.cmd run miniapp:appid -- wx你的真实AppID`.

## AppID Gate

- Run `npm.cmd run miniapp:appid -- wx你的真实AppID` only with the real AppID from WeChat MP.
- Confirm `miniprogram/project.private.config.json` is created or updated.
- Confirm `miniprogram/project.config.json` is not edited by the AppID helper.
- Run `npm.cmd run miniapp:fullcheck -- --upload-ready` or `node scripts/miniapp-fullcheck.cjs --upload-ready`.
- Confirm upload gate passes only after the active AppID is no longer `touristappid`.
- Confirm no real AppID is committed unless the repo policy explicitly allows it.

## Real-Device Smoke Path

- Home: parent immediately sees tonight's first step and the main route; the teacher selection area feels companion-like but does not overpower the main CTA.
- Upload: text entry works; image entry/album path opens if device permission is available; no OCR or photo-answer promise appears.
- Diagnosis: `3 个问题先看今晚第一步` is visible; CTA says `生成今晚第一步安排`; no `快测` or report wording is visible.
- Review: child can identify `今天卡在哪`, `先看哪里`, and `你要说出的第一步`; invalid mini-action text cannot complete repair.
- Blackboard: appears only after a real `todayFocus` enters repair state; it only tells the first place to look and never gives a full answer.
- Tools: path reads as light revisit/light practice; no game collection, challenge factory, or commercial bundle language.
- Profile: parent gets a 5-second recap; no paid/commercial/report-wall language; no internal key, enum, source, or stage is visible.
- Radar: page reads as `今晚先看这一点` and `今晚学习留痕`, not a diagnostic report wall.
- Tutor: page says why only one step is prompted; direct-answer requests are pulled back to first-step guidance.
- Arcade: if reached from legacy/deep path, it should read as light recall/practice and not as ranking, PK, or challenge growth.
- Module: learning module copy routes back to first-step/tutor/revisit; no full-solution or answer-generation wording.

## Banned Visible Terms To Recheck

Search user-visible and review-facing surfaces for:

`闯关`, `知识关卡`, `XP`, `报告墙`, `付费`, `服务方案`, `快测`, `雷达`, `弱点`, `带学面板`

Allowed exceptions:

- Stable internal route or data identifiers such as `/pages/profile`, `weak_points`, `xp`, or test fixture names.
- Historical product docs not used for current review or real-device smoke.
- Guardrail docs that explicitly describe what must not happen.

## Pass Criteria

- `npm.cmd test` passes.
- `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1` passes.
- Upload-ready gate is blocked when AppID is `touristappid`.
- Upload-ready gate passes only with a real configured AppID.
- No AppID placeholder, fake AppID, API key, or Qwen key is introduced.
