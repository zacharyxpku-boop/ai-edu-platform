# Yuandian Miniapp Product Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**收束原点智学小程序为一条可试用、可验证的完整学习闭环：今晚路线 -> AI 私教 -> 小课堂/修卡 -> 回忆游戏 -> 安全分享 -> 家长报告行动 -> 首页回流。

**Architecture:**Use the existing miniapp pages, view-models, local storage ledger, and test suite. Do not rebuild the product; tighten the home next-action arbitration, make report/mini-lesson/share/revisit all return as “tonight one step”, and add tests that protect the loop.

**Tech Stack:**WeChat miniapp WXML/WXSS/JS, CommonJS utility modules, Node `.cjs` test scripts, PowerShell `scripts/verify.ps1`.

---

## File Map

- `docs/superpowers/specs/2026-05-24-yuandian-miniapp-product-loop-design.md`: accepted product-loop design source.
- `docs/PRODUCT-LOOP-IMPLEMENTATION-CHECKLIST.md`: create a concise operator checklist for page ownership, evidence output, and forbidden claims.
- `scripts/test-product-convergence.cjs`: extend as the primary product-loop contract test.
- `miniprogram/view-models/home-view-model.js`: centralize the home “one next step” priority.
- `miniprogram/pages/home/home.js`: pass report, mini-lesson, revisit, share, and unified action evidence into the view model.
- `miniprogram/pages/home/home.wxml`: keep first-screen action focused and push secondary surfaces down.
- `miniprogram/pages/tutor/tutor.js` and `miniprogram/pages/tutor/tutor.wxml`: ensure failed Socratic turns visibly route to mini-lesson or parent handoff.
- `miniprogram/pages/upload/upload.js`: preserve report handoff context into `learningReportState`.
- `miniprogram/pages/review/review.js`: ensure report-sourced review completion records report revisit evidence.
- `miniprogram/pages/arcade/arcade.js`: ensure game completion carries report/share/review context back to the ledger.
- `miniprogram/pages/profile/profile.js` and `miniprogram/pages/profile/profile.wxml`: keep report validation and parent action visible without long-term labels.

## Task 1: Add Implementation Checklist

**Files:**
- Create: `docs/PRODUCT-LOOP-IMPLEMENTATION-CHECKLIST.md`

- [ ] **Step 1: Create the checklist document**

Use this exact content:

```markdown
# Product Loop Implementation Checklist

Date: 2026-05-24

## One Product Sentence

原点智学是面向中国家庭晚间作业场景的 AI 私教路线系统：先帮孩子说出今晚第一步，再把卡点变成回访，把家长上传的材料变成 7 天行动。

## Page Ownership

| Page | Primary job | Evidence output | Must not do |
|---|---|---|---|
| home | Decide tonight's one next step | `homeViewModel.primaryNextAction` | Lead with report upload, games, roles, dashboard, ranking |
| tutor | Ask for first-step thinking | `tutorEvents`, `todayFocus`, `miniLessonFeedbackBridge` | Give final answer or full solution |
| review | Repair one stuck card | `reviewCard`, `wrongCause`, `recordReportRevisitEvidence` | Become a static wrong-question wall |
| focus | Finish the confirmed small step | `focusSession`, `parentRecapViewed` | Start without first-step evidence |
| tools | Revisit one small card | `reviewEvents`, `lightFeatureEvidence` | Look like a tool directory |
| arcade | Turn cards into active recall | `gameEvidence`, `wrongAnswers`, `nextPracticePlan` | Fake leaderboard, fake friend challenge, score/ranking reward |
| upload | Accept homework/report/material | `learningReportState`, `uploadReportHandoff` | End at a static report |
| profile | Parent 5-second recap | `parentOneQuestion`, `reportRevisitEvidence` | Long-term labels, talent claims, dashboard first screen |

## Required Loop

1. Home accepts homework, stuck point, report recommendation, mini-lesson resume, review card, or share return.
2. Tutor asks for the child's first step and blocks direct-answer requests.
3. Mini lesson appears only when the first step cannot be recovered by normal prompting.
4. Review turns the stuck point into a wrong-cause card and revisit action.
5. Focus records that the child actually worked on the confirmed step.
6. Tools and Arcade run active recall from real cards only.
7. Share Relay carries only first step, wrong cause, parent check, and revisit action.
8. Upload and Report turn parent materials into tonight action plus 7-day validation.
9. Profile shows parent one-question recap and report validation.
10. Home receives every branch back as one next step.

## Hard Boundaries

- No final answer as the main path.
- No original question, full dialogue, score, ranking, photos, names, or contact details in share/reward surfaces.
- No fake leaderboard or fake social graph.
- No talent label or long-term diagnosis before multi-day evidence.
- No upload/review claim while `touristappid`, production AI provider, or cloud persistence are missing.
```

- [ ] **Step 2: Verify the checklist exists**

Run:

```powershell
Test-Path docs\PRODUCT-LOOP-IMPLEMENTATION-CHECKLIST.md
```

Expected: `True`

## Task 2: Add Home Priority Contract Test

**Files:**
- Modify: `scripts/test-product-convergence.cjs`
- Test: `scripts/test-product-convergence.cjs`

- [ ] **Step 1: Add source reads for the home view-model**

Add this entry to the `pages` object:

```js
homeViewModelJs: read('miniprogram/view-models/home-view-model.js'),
```

- [ ] **Step 2: Add a product-loop priority contract near the existing Home assertions**

Add this block after the `showLightTools` assertions:

```js
includesAll(
  pages.homeViewModelJs,
  [
    'buildPrimaryHomeNextAction',
    "type: 'report_action'",
    "type: 'mini_lesson'",
    "type: 'review_return'",
    "type: 'share_return'",
    "type: 'first_step'",
    'priority'
  ],
  'Home view model owns the unified next-step priority'
);
assert(
  pages.homeWxml.includes('homeViewModel.primaryNextAction')
  && pages.homeJs.includes('primaryNextAction'),
  'Home first screen renders the single primary next action from the view model'
);
assert(
  pages.homeWxml.indexOf('homeViewModel.primaryNextAction') < pages.homeWxml.indexOf('learningLoopCards'),
  'Home primary next action appears before capability cards'
);
```

- [ ] **Step 3: Run the test and confirm it fails before implementation**

Run:

```powershell
node scripts\test-product-convergence.cjs
```

Expected: FAIL mentioning `buildPrimaryHomeNextAction` or `primaryNextAction`.

## Task 3: Implement Home Primary Next-Action View Model

**Files:**
- Modify: `miniprogram/view-models/home-view-model.js`
- Test: `scripts/test-product-convergence.cjs`

- [ ] **Step 1: Add the priority builder**

Insert after `buildReportServiceResume`:

```js
function buildPrimaryHomeNextAction(input = {}) {
  const candidates = [];
  if (input.reportServiceResume) {
    candidates.push({
      type: 'report_action',
      priority: 10,
      kicker: '报告建议',
      title: safeText(input.reportServiceResume.title, '继续家庭方案验证'),
      body: safeText(input.reportServiceResume.actionLine || input.reportServiceResume.statusLine, '今晚只做一个最小动作。'),
      cta: safeText(input.reportServiceResume.cta, '继续行动'),
      action: 'reportService',
      route: input.reportServiceResume.route || '/pages/profile/profile?from=home_report_service_resume'
    });
  }
  if (input.miniLessonResume) {
    candidates.push({
      type: 'mini_lesson',
      priority: 20,
      kicker: '3 分钟小课堂',
      title: safeText(input.miniLessonResume.topicLabel || input.miniLessonResume.title, '继续小课堂'),
      body: `小黑板：${safeText(input.miniLessonResume.blackboardLine, '先说出第一步')}`,
      cta: '继续小课堂',
      action: 'miniLesson',
      route: input.miniLessonResume.route || '/pages/review/review?from=home_mini_lesson_resume'
    });
  }
  if (input.yesterdayReviewCard) {
    candidates.push({
      type: 'review_return',
      priority: 30,
      kicker: '轻回访',
      title: safeText(input.yesterdayReviewCard.noticeText, '接上昨天那一步'),
      body: safeText(input.yesterdayReviewCard.childArticulatedStep, '先复述昨天的第一步。'),
      cta: '继续回访',
      action: 'reviewReturn',
      route: '/pages/review/review?from=home_yesterday_review'
    });
  }
  if (input.incomingShareRelay) {
    candidates.push({
      type: 'share_return',
      priority: 40,
      kicker: '学习复盘卡',
      title: safeText(input.incomingShareRelay.title || input.incomingShareRelay.defaultReceiverActionTitle, '接住一个学习动作'),
      body: safeText(input.incomingShareRelay.defaultReceiverActionLine || input.incomingShareRelay.summary, '只接第一步、错因和回访动作。'),
      cta: safeText(input.incomingShareRelay.defaultReceiverAction && input.incomingShareRelay.defaultReceiverAction.displayLabel, '接力这一小步'),
      action: 'shareReturn',
      route: input.incomingShareRelay.defaultReceiverAction && input.incomingShareRelay.defaultReceiverAction.route
        ? input.incomingShareRelay.defaultReceiverAction.route
        : '/pages/review/review?from=home_share_return'
    });
  }
  if (input.todayFocus) {
    candidates.push({
      type: 'first_step',
      priority: 50,
      kicker: '今晚路线',
      title: '接上已经确认的第一步',
      body: safeText(input.todayFocus.systemSuggestedStep || input.todayFocus.childArticulatedStep, '先把这一小步做完。'),
      cta: '去专注舱',
      action: 'focus',
      route: '/pages/focus/focus?from=home_primary_next'
    });
  }
  const selected = candidates.sort((a, b) => a.priority - b.priority)[0];
  return selected || {
    type: 'first_step',
    priority: 90,
    kicker: '今晚路线',
    title: '今晚作业先从哪一步开始？',
    body: '发作业清单，或者说一句你卡在哪里。',
    cta: '帮我安排今晚学习',
    action: 'firstStep',
    route: '/pages/tutor/tutor?from=home_primary_next'
  };
}
```

- [ ] **Step 2: Wire it into `buildHomeViewModel`**

Inside `buildHomeViewModel`, after `const reportServiceResume = buildReportServiceResume(input);`, add:

```js
const primaryNextAction = buildPrimaryHomeNextAction(Object.assign({}, input, {
  miniLessonResume,
  reportServiceResume
}));
```

Then add `primaryNextAction,` to the returned object.

- [ ] **Step 3: Export the builder**

Update `module.exports`:

```js
module.exports = {
  buildHomeViewModel,
  buildPrimaryHomeNextAction
};
```

- [ ] **Step 4: Run focused test**

Run:

```powershell
node scripts\test-product-convergence.cjs
```

Expected: The prior `buildPrimaryHomeNextAction` failure is gone.

## Task 4: Render the Primary Next Action on Home

**Files:**
- Modify: `miniprogram/pages/home/home.js`
- Modify: `miniprogram/pages/home/home.wxml`
- Test: `scripts/test-product-convergence.cjs`

- [ ] **Step 1: Pass all branch evidence into the view model**

In `refreshHomeState`, where `homeViewModel: buildHomeViewModel({ ... })` is set, include:

```js
yesterdayReviewCard,
incomingShareRelay: this.buildIncomingShareRelay(incomingShare),
reportServiceResume,
```

Use existing local variables where available. If `incomingShareRelay` is already computed inline, store it in a local variable first:

```js
const incomingShareRelay = this.buildIncomingShareRelay(incomingShare);
```

- [ ] **Step 2: Add first-screen WXML card above `yesterday-review-card`**

Insert before `<view class="yesterday-review-card"`:

```xml
      <view class="primary-next-action-card" wx:if="{{homeViewModel.primaryNextAction}}" catchtap="runPrimaryNextAction">
        <view class="primary-next-action-kicker">{{homeViewModel.primaryNextAction.kicker}}</view>
        <view class="primary-next-action-title">{{homeViewModel.primaryNextAction.title}}</view>
        <view class="primary-next-action-body">{{homeViewModel.primaryNextAction.body}}</view>
        <view class="primary-next-action-cta">{{homeViewModel.primaryNextAction.cta}}</view>
      </view>
```

- [ ] **Step 3: Add the handler**

Add this method near `runHomeNextStep`:

```js
  runPrimaryNextAction() {
    const next = this.data.homeViewModel && this.data.homeViewModel.primaryNextAction;
    if (!next) return;
    if (next.action === 'reportService') {
      this.goReportServiceResume();
      return;
    }
    if (next.action === 'miniLesson') {
      this.goMiniLessonResume();
      return;
    }
    if (next.action === 'reviewReturn') {
      this.continueYesterdayReview();
      return;
    }
    if (next.action === 'shareReturn') {
      navigation.navigateLearningRoute(next.route || '/pages/review/review?from=home_share_return');
      return;
    }
    if (next.action === 'focus') {
      this.goFocus();
      return;
    }
    this.openTutorFromHome(next.route || '/pages/tutor/tutor?from=home_primary_next');
  },
```

- [ ] **Step 4: Add minimal styles**

Add to `miniprogram/pages/home/home.wxss`:

```css
.primary-next-action-card {
  padding: 24rpx;
  margin-bottom: 18rpx;
  border-radius: 20rpx;
  background: #fffdf8;
  border: 1rpx solid rgba(15, 79, 61, 0.18);
  box-shadow: 0 14rpx 34rpx rgba(36, 45, 39, 0.08);
}

.primary-next-action-kicker {
  font-size: 22rpx;
  color: #0f4f3d;
  font-weight: 700;
  margin-bottom: 8rpx;
}

.primary-next-action-title {
  font-size: 32rpx;
  color: #1f2f2a;
  font-weight: 800;
  line-height: 1.28;
}

.primary-next-action-body {
  margin-top: 10rpx;
  font-size: 25rpx;
  color: #625c52;
  line-height: 1.45;
}

.primary-next-action-cta {
  margin-top: 16rpx;
  font-size: 25rpx;
  color: #0f4f3d;
  font-weight: 800;
}
```

- [ ] **Step 5: Run focused test**

Run:

```powershell
node scripts\test-product-convergence.cjs
```

Expected: PASS or only unrelated existing assertion failure.

## Task 5: Strengthen Report-to-Home Contract

**Files:**
- Modify: `scripts/test-product-convergence.cjs`
- Modify if needed: `miniprogram/pages/upload/upload.js`
- Modify if needed: `miniprogram/pages/home/home.js`

- [ ] **Step 1: Add test assertion**

Add after the report engine contract block:

```js
assert(
  pages.uploadJs.includes('saveLearningReportState')
  && pages.homeJs.includes('reportServiceResume')
  && pages.homeViewModelJs.includes("type: 'report_action'"),
  'Uploaded report state returns to Home as a primary report action'
);
```

- [ ] **Step 2: Run test**

Run:

```powershell
node scripts\test-product-convergence.cjs
```

Expected: PASS if existing code already satisfies the contract; otherwise FAIL naming the missing path.

- [ ] **Step 3: If failing, wire report handoff into Home**

In `home.js`, ensure the `buildHomeViewModel` call includes `learningReportState` and any saved `uploadReportHandoff`:

```js
const learningReportState = storage.loadLearningReportState ? storage.loadLearningReportState() : null;
const uploadReportHandoff = storage.loadUploadReportHandoff ? storage.loadUploadReportHandoff() : null;
```

Then pass both into `buildHomeViewModel`.

## Task 6: Focused Verification

**Files:**
- No code changes unless failures identify direct misses.

- [ ] **Step 1: Run focused loop tests**

Run:

```powershell
node scripts\test-product-convergence.cjs
node scripts\test-tutor-ladder.cjs
node scripts\test-report-revisit-loop.cjs
node scripts\test-review-engine.cjs
node scripts\test-share-relay-behavior.cjs
node scripts\test-share-relay-safety.cjs
```

Expected: each command exits `0`.

- [ ] **Step 2: Run full repo verification**

Run:

```powershell
C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1
```

Expected: PASS. If it fails, stop at the first real blocker and record the failing command and smallest fix path.

## Task 7: Sync Readiness Report

**Files:**
- Modify: `docs/PRODUCT-LOOP-IMPLEMENTATION-CHECKLIST.md`

- [ ] **Step 1: Append verification status**

Append:

```markdown
## Latest Verification

- Focused product-loop tests: PASS after implementation.
- Full verification: pending until this line is updated with the exact command result.
- Miniapp sync: do not sync to `aiedumini` until full verification passes and the dirty worktree is intentionally reviewed.
```

- [ ] **Step 2: If full verification passed, sync to `aiedumini` using the repo script**

Run only if full verification passed:

```powershell
npm.cmd run miniapp:sync:aiedumini -- --commit
```

Expected: either a real sync commit in `C:\Users\86136\Desktop\claude\aiedumini`, or a clear “no changes to sync” result.

- [ ] **Step 3: Confirm destination repo state**

Run:

```powershell
git -C C:\Users\86136\Desktop\claude\aiedumini status -sb
```

Expected: clean or only the new intended sync commit ahead of origin.
