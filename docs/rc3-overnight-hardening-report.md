# RC3.2 Overnight Hardening & Release Freeze Audit

Date: 2026-05-13

## 1. Scope

This round was a release-freeze audit before real AppID configuration and real-device screenshots. It did not add a new feature, Tab, backend API, teacher, Qwen API integration, OCR, photo search, import flow, payment, ranking, dashboard, or large UI refactor.

The product path remains:

排顺序 -> 说第一步 -> 修卡点 -> 原点小黑板提示 -> 轻回访 -> 整理给家长看

## 2. Baseline Verification

Baseline commands were run before the final report:

- `npm.cmd test`: passed.
- `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1`: passed.

Non-fatal gate:

- `miniprogram/project.config.json` still uses `touristappid`.
- Local verification passes, but upload/submit remains blocked until a real AppID is configured.

## 3. Code Changes This Round

No new product capability was added.

Minimal P1 hardening was made:

- `miniprogram/utils/storage.js`
  - Added `题目条件太多，我不知道怎么用` style patterns to the `读题审题` classifier.
  - This keeps the existing focus/review flow intact and routes the case to the existing read-the-question review prompt: first look at the question, then related conditions.

- `scripts/test-learning-evidence-flow.cjs`
  - Strengthened the condition-overload scenario.
  - Now asserts `issueType = 读题审题`, original `sourceText` is saved, the title keeps `条件太多`, and the generated review card reminds the child to look at the question and related conditions.
  - Adjusted the knowledge-playground miniActionText assertion to check for evidence anywhere in the generated focus-card list instead of relying on list order.

No core storage shape, backend API, UI structure, companionPreference mechanism, miniActionText gate, blackboard evidence fields, reviewCard flow, or growthMemory flow was changed.

## 4. Four ViewModel Audit

### Home

- `routePill`: `今晚路线 · 第 1 步：排顺序`.
- `title`: `今晚从哪一步开始？`.
- `primaryCta`: `帮我安排今晚学习`.
- Teacher area remains a companionship selector, not a functional division.
- First screen binds `homeViewModel.*`; raw focus/source/issueType are not shown as primary copy.

### Review

- `routePill`: `今晚路线 · 第 3 步：修卡点`.
- `title`: `今晚只修一个卡点`.
- MiniAction input appears only in the repair evidence state.
- No todayFocus path keeps one main action: `去说第一步`.
- Blackboard is produced only when there is a supported todayFocus and the repair state has started.
- Blackboard templates do not output final answers or full solution copy.

### Tools

- `routePill`: `今晚路线 · 第 4 步：轻回访`.
- `title`: `今天回访一小步`.
- With reviewCard, CTA is `开始回访`.
- Without reviewCard, CTA is `开始试玩`.
- Game/play areas are below the first screen and do not replace the main review task.

### Profile

- `routePill`: `今晚路线 · 第 5 步：整理给家长看`.
- `title`: `今晚家长只问这一句`.
- Primary card stays around:
  - 今天卡在哪
  - 孩子说出的第一步
  - 老师提示你先看
  - 家长只问一句
  - 明天怎么回访
- Legacy report/game/commercial modules still exist, but they are not the first-screen source of truth.

## 5. Page Binding Audit

Checked:

- `miniprogram/pages/home/home.wxml`
- `miniprogram/pages/review/review.wxml`
- `miniprogram/pages/entry-detail/entry-detail.wxml`
- `miniprogram/pages/profile/profile.wxml`

Result:

- First-screen main copy is bound through `homeViewModel`, `reviewViewModel`, `toolsViewModel`, and `profileViewModel`.
- `source` hits in WXML are CSS class names or below-fold legacy panels, not raw user-facing key output.
- `profile` still contains legacy panels such as wrong-cause, game profile, daily share, parent report, and unlock card areas, but they are after the first screen or behind panel navigation.
- `tools` advanced practice area is below the first-screen review card.
- `review` advanced mistake-management area is below the first-screen repair card.

Residual risk:

- Legacy panels are still present by design. They remain a P1/P2 cleanup target for later, but are not a current RC3.2 P0 because the first-screen viewModel contract holds.

## 6. Teacher 2x3 Audit

Home teacher selector remains lightweight:

- 小原 | 帮我理顺一点
- 问问 | 多问我一步
- 安安 | 慢一点陪我
- 阿衡 | 记得我以前卡点
- 团团 | 帮我讲给家长听
- 跃跃 | 陪我闯一小关

Audit result:

- No subject-teacher labels were found in first-screen viewModels/WXML.
- No teacher functional division copy was found in first-screen viewModels/WXML.
- Selection still flows through `companionPreference` / `selectedCompanion`.
- Styling is already compact: 2x3 grid, short labels, light selected state.

## 7. Blackboard Audit

Blackboard behavior checked through code and tests:

- Requires todayFocus.
- Appears only after repair has started, not on the default home path.
- Supports:
  - 列式关系 -> 关系小黑板 -> 整体 -> 部分 -> 关系
  - 读题审题 -> 审题小黑板 -> 问题 -> 条件 -> 第一步
  - 步骤断点 -> 步骤小黑板 -> 第一步 -> 下一步 -> 检查
  - 概念公式 -> 概念小黑板 -> 概念 -> 条件 -> 公式
- Does not generate final answers.
- Does not produce complete solution steps.
- Does not use answer-tool phrases in blackboard templates.
- `blackboardHint` / `blackboardUsedAt` can be saved locally.
- `reviewCard` can reference the blackboard structure.
- `profileViewModel` can show one lightweight evidence line.

## 8. Evidence Flow Audit

Targeted tests run and passed:

- `node scripts/test-learning-evidence-flow.cjs`
- `node scripts/test-rc3-teacher-blackboard.cjs`
- `node scripts/test-profile-view-model.cjs`
- `node scripts/test-tools-view-model.cjs`
- `node scripts/test-review-view-model.cjs`
- `node scripts/test-home-view-model.cjs`
- `node scripts/test-companion-voice-layer.cjs`

Covered flows:

- `我写到第二步就乱了` -> `步骤断点`, valid miniActionText gates completion, reviewCard/profile keep concrete evidence.
- `我不确定单位1是谁` -> `列式关系`, repair state shows blackboard, review/profile can keep blackboard evidence.
- `题目条件太多，我不知道怎么用` -> `读题审题`, sourceText saved, review prompt asks to first look at the question and related conditions.
- Invalid miniActionText such as `不知道`, `不会`, `随便`, `求答案`, `直接看答案` cannot complete repair.

## 9. Forbidden Copy / Internal Key Scan

Scanned viewModels and first-screen WXML for:

- `home_xiaodian_entry`
- `needs_student_step`
- `今日老师接手`
- `6 位老师怎么分工`
- `当前演示判断`
- `近 7 天错误类型分布`
- `系统诊断`
- `家长应监督`
- `严重薄弱`
- `孩子问题`
- `数学老师 / 英语老师 / 语文老师 / 科学老师`
- `小满`
- `秒解`
- `答案已生成`
- `拍照出答案`
- `排行榜 / PK / 冲榜`

Result:

- No hits in the four viewModel first-screen outputs or the four first-screen WXML user-visible bindings.
- Some hits remain in historical docs, test assertions, formatter fixtures, internal storage mappings, and blocker regexes. These are intentional audit/test/internal uses, not first-screen user-visible output.
- `home_xiaodian_entry` and `needs_student_step` still exist as internal keys and formatter test fixtures, but formatter coverage prevents raw key display.

## 10. Small-Screen Risk Review

Checked likely small-screen pressure points:

- Home 2x3 teacher grid is compact and below the main CTA area.
- Review miniAction input is only conditional in repair state.
- Tools advanced games are hidden behind the first-screen task.
- Profile primary card is viewModel-bound and legacy panels are not first-screen primary content.
- Existing bottom padding uses safe-area values, reducing CTA/tab overlap risk.
- Header/top areas already use safe-area padding.

Residual risk:

- Real-device screenshots are still needed to validate actual capsule collision, bottom Tab overlap, and long text wrapping across device sizes.

## 11. Final Verification

Final commands:

- `npm.cmd test`: passed.
- `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File scripts\verify.ps1`: passed.

Verify notes:

- Security scan: no secret-like tokens found.
- Upload-ready gate: blocked only by real AppID requirement.
- Required request domain remains `https://yuandianzhixue.com`.
- Git line-ending warnings were reported by git and are non-fatal.

## 12. Release Gate

Current state:

- No known RC3.2 code P0 remains.
- The remaining gate is non-code:
  - Configure real AppID instead of `touristappid`.
  - Configure WeChat request合法域名: `https://yuandianzhixue.com`.
  - Enter real-device screenshot acceptance.

Recommended next command after obtaining the real AppID:

```powershell
npm.cmd run miniapp:appid -- wx你的真实AppID
```
