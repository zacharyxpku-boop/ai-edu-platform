# RC6 Manual DevTools Smoke Test

## Scope

This checklist verifies the frozen RC6 local-first MVP in WeChat DevTools before real AppID replacement or upload.

Do not change AppID, upload, add features, redesign UI, or add assets during this smoke test. Only stop and fix if a P0 smoke blocker is found.

## Pre-Flight

- [ ] Open WeChat DevTools.
- [ ] Import or open `miniprogram/`.
- [ ] Confirm `miniprogram/project.config.json` still uses `touristappid`.
- [ ] Clear cache: DevTools -> Clear Cache -> Clear All.
- [ ] Recompile.
- [ ] Keep Console visible.

Pass criteria:

- DevTools recompiles without red startup errors.
- Simulator does not show a blank first screen.
- Upload is not attempted.

Fail criteria:

- Home returns to a blank screen.
- Console shows red startup/runtime errors.
- DevTools cannot compile the project.

## 1. Home First Render

- [ ] Confirm Home renders as the launch page.
- [ ] Confirm the main question is visible: tonight starts from the first step.
- [ ] Confirm 咕点 appears as the single companion voice.
- [ ] Confirm no six-teacher selector appears.

Pass criteria:

- Home first screen is visible and usable.
- Primary input/CTA is visible.
- No teacher-matrix or direct-answer wording is visible.

Fail criteria:

- Home is blank.
- Primary CTA is missing or unclickable.
- Visible copy returns to teacher-selection, report-wall, or answer-solver framing.

## 2. Bottom Tab Render

- [ ] Confirm bottom custom tab bar appears.
- [ ] Confirm five tabs are visible:
  - 作业点拨
  - 专注舱
  - 修卡点
  - 轻回访
  - 我的
- [ ] Tap each tab once.

Pass criteria:

- Every tab switches to a rendered first screen.
- Selected tab state updates correctly.
- No tab click creates a red Console error.

Fail criteria:

- Any tab is missing.
- Any tab opens a blank page.
- Any tab route is dead.

## 3. Stuck Point Input

- [ ] Return to Home.
- [ ] Enter a simple stuck point, for example:

```text
我卡在应用题第一步，不知道先看题目里的哪个条件。
```

- [ ] Tap the primary action.

Pass criteria:

- Input is accepted.
- The app routes to the next valid input/diagnosis/review step.
- No copy promises direct answers, photo-answer, or instant solving.

Fail criteria:

- Primary CTA does nothing.
- Input is lost without feedback.
- Console shows a red runtime error.

## 4. Diagnosis Three-Question Flow

- [ ] Open Diagnosis if not routed there automatically.
- [ ] Answer the three questions:
  - 你已经看懂了哪一部分？
  - 你是从哪里开始卡住的？
  - 你觉得第一步可以先看哪里？
- [ ] Submit to generate tonight's first-step state.

Pass criteria:

- All three answers can be entered.
- Submit produces a usable first-step state.
- Flow routes forward to a valid page.

Fail criteria:

- Any answer field cannot be edited.
- Submit is dead.
- First-step state is not produced.

## 5. Review First-Step Card

- [ ] Open 修卡点.
- [ ] Confirm the first-step card shows:
  - 我卡在哪
  - 我先看哪里
  - 我的第一步怎么说
- [ ] Confirm 原点小黑板, if shown, only points to the first step and does not give a full answer.

Pass criteria:

- Review first screen renders.
- First-step information is readable.
- CTA can route to 专注舱.

Fail criteria:

- Review first screen is blank.
- First-step card is missing after diagnosis.
- CTA is dead.

## 6. Enter 专注舱

- [ ] Enter 专注舱 from Review.
- [ ] Return to Home and enter 专注舱 from Home if a first step exists.

Pass criteria:

- 专注舱 opens from both valid entry points.
- Current focus target binds to tonight's first step.
- If no first step exists, manual task input is visible.

Fail criteria:

- 专注舱 route is dead.
- Focus target is blank or shows internal keys.
- No-data state is broken.

## 7. Focus Timer Controls

- [ ] Select 15 minutes.
- [ ] Tap Start.
- [ ] Tap Pause.
- [ ] Tap Resume.
- [ ] Tap Complete.
- [ ] Start another session.
- [ ] Tap Interrupt.
- [ ] Tap Reset.

Pass criteria:

- Timer state changes correctly for start, pause, resume, complete, interrupt, and reset.
- Completion creates visible encouragement.
- Interrupted state is gentle and does not erase the page.

Fail criteria:

- Timer does not start.
- Pause/resume is stuck.
- Completion does not persist.
- Interrupt crashes or leaves an impossible state.

## 8. Scene Switching

- [ ] Switch through built-in scenes:
  - 暖光书桌
  - 雨天窗边
  - 夜晚自习室
  - 清晨书房
  - 安静图书馆
  - 星舰学习舱
  - 城市夜景
  - 二次元陪学感

Pass criteria:

- Scene selection visibly updates.
- Selected scene stays stable while interacting with the timer.
- Missing final art assets do not block the placeholder UI.

Fail criteria:

- Scene tap does nothing.
- Page flashes blank or crashes.
- Scene labels show internal IDs.

## 9. Audio Mode Switching

- [ ] Switch through audio modes:
  - 静音
  - 雨声
  - 白噪音
  - 咖啡馆
  - 轻音乐
  - 图书馆环境音
  - 星舰舱
- [ ] Adjust volume.

Pass criteria:

- Selected audio state updates.
- Volume state updates.
- Placeholder audio mode is honest and does not require external integration.

Fail criteria:

- Audio mode tap crashes.
- Volume slider causes red Console errors.
- UI implies a real music platform integration that does not exist.

## 10. Profile Recap After Focus Completion

- [ ] Complete a focus session.
- [ ] Open 我的.
- [ ] Confirm 专注舱记录 appears.
- [ ] Confirm parent-readable recap is visible.

Pass criteria:

- Profile reads latest focus evidence.
- Parent recap is short and understandable.
- Page does not look like a report wall or commercial page.

Fail criteria:

- Profile cannot read recap.
- Focus completion is missing.
- Commercial/payment/course UI appears in the first screen.

## 11. Tools Light Revisit After Focus Completion

- [ ] Open 轻回访.
- [ ] Confirm recent stuck point or focus evidence appears.
- [ ] Confirm the page still feels like light revisit, not a toolbox or game lobby.

Pass criteria:

- Tools can read recent focus/review evidence.
- Primary CTA routes to a valid next action.
- No fake social/backend dependency blocks local use.

Fail criteria:

- Tools first screen is blank.
- Revisit evidence is absent after focus completion.
- Primary CTA is dead.

## 12. Empty States After Clearing Local Data

- [ ] Clear cache/local data again.
- [ ] Recompile.
- [ ] Visit Home, Review, 专注舱, Tools, Profile.

Pass criteria:

- Every core page renders with no data.
- Empty states route to valid next actions.
- 专注舱 shows manual task fallback.

Fail criteria:

- Any first screen crashes.
- Any empty state shows internal keys.
- Any primary empty-state CTA is dead.

## 13. Console Red Error Check

- [ ] Keep Console open during the full smoke path.
- [ ] Record any red errors.
- [ ] Ignore non-blocking warnings only if the page remains usable and no core state is broken.

Pass criteria:

- No red startup/runtime errors occur during the core loop.

Fail criteria:

- Any red error appears on startup.
- Any red error appears after clicking a primary CTA.
- Any red error appears when completing a focus session.

## Do Not Proceed

Stop before AppID replacement if any of the following happen:

- Home blank screen returns.
- Any tab first screen fails to render.
- Any primary CTA is dead.
- Focus session completion does not persist.
- Profile cannot read recap.
- Tools cannot read revisit evidence.
- Console shows red startup/runtime errors.

## Smoke Result Template

Smoke date:

DevTools version:

Simulator device:

Pass/Fail:

Console errors:

Screenshots needed:

- Home first render:
- Review first-step card:
- 专注舱 running:
- 专注舱 completed:
- Profile recap:
- Tools light revisit:
- Empty state:

Blocker summary:

Decision:

- [ ] Ready for real AppID replacement
- [ ] Not ready; blocker must be fixed first

