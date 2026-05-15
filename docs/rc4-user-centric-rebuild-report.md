# RC4 User-Centric Rebuild Report

Date: 2026-05-13

## 1. Scope

This round did not add a feature, Tab, backend API, teacher, dashboard, Qwen API, OCR, photo-search, PDF/PPT import, or full-answer generation.

The work was a user-scenario copy and hierarchy pass over existing viewModels and first-screen bindings.

## 2. Home

Home changed from a system/route entry into a family-night entry.

Current first question:

- `今晚作业先从哪一步开始？`

Current supporting copy:

- `发作业清单，或者说一句你卡在哪里。`
- Input card: `把今晚作业或卡住点发过来`
- Placeholder: `比如：数学 8 道明天交；或者：我写到第二步就乱了。`
- CTA: `帮我安排今晚学习`
- Secondary action: `我已经卡住了`

Teacher selector is now:

- `今天想被怎么陪？`

Teacher cards use shorter companionship copy:

- 小原 | 理顺一点
- 问问 | 多问一步
- 安安 | 慢一点
- 阿衡 | 记得我
- 团团 | 讲给家长
- 跃跃 | 闯一小关

No teacher functional division was added.

## 3. Review

Review now reads as “only repair one real stuck point”.

Current first question:

- `今晚只修一个卡点`

Primary card now centers:

- 今天卡在哪
- 先看哪里
- 你要说出的第一步

MiniAction copy now speaks directly to the child:

- `用一句话说说你的第一步`
- Placeholder: `比如：我先找题目问什么。`

The completion gate still requires valid miniActionText. Invalid answer-seeking inputs still cannot complete repair.

Blackboard copy now makes the boundary visible:

- `我不直接讲答案，只帮你看清第一步。`

Unsupported issueType still does not show a blackboard.

## 4. Tools

Tools now reads as “tomorrow recall”, not a gameplay collection.

When there is a review card:

- Title: `回访昨天修过的卡点`
- Body: `看看你还记不记得当时说出的第一步。`
- CTA: `开始回访`

When there is no review card:

- Title: `还没有回访卡`
- Body: `修完一个卡点后，这里会出现明天的回访卡。现在可以先试玩 2 分钟。`
- CTA: `开始试玩`

The play area remains sunk behind:

- `想轻松练一下`

It does not replace the first-screen recall task.

## 5. Profile

Profile remains “parent asks only one question”.

Current first question:

- `今晚家长只问这一句`

Subtitle now focuses on child evidence:

- `不是看分数，是看孩子今天有没有说出第一步。`

Primary card remains:

- 今天卡在哪
- 孩子说出的第一步
- 老师提示你先看
- 家长只问一句
- 明天怎么回访

It is still not a system diagnosis report.

## 6. System Terms Moved Out Of UI

The RC4 test now checks that viewModel user-visible strings avoid:

- todayFocus
- reviewCard
- issueType
- growth memory
- companionPreference
- blackboardHint
- miniActionText
- proofScore
- benchmark

Code and tests may still use these terms internally. The user-facing layer should say:

- 今晚路线
- 卡住的一步
- 孩子说出的第一步
- 明天回访卡
- 家长只问一句
- 小黑板提示

## 7. Core Flow Impact

Core learning flow was not changed:

- tonightPlan remains intact.
- todayFocus remains intact.
- miniActionText gate remains intact.
- blackboardHint / blackboardUsedAt remain intact.
- reviewCard generation remains intact.
- growthMemory remains intact.
- companionPreference remains intact.

One small P0 boundary fix was made while testing:

- Unsupported issueType no longer produces an empty blackboard object with only intro text.

## 8. Tests

Added:

- `scripts/test-rc4-user-centric-copy.cjs`

Updated:

- home / review / tools / profile viewModel tests for RC4 scenario wording.
- companion preference tests for shorter teacher-card copy.
- RC3 product coherence test to allow the explicit non-answer blackboard boundary while still banning answer-tool wording inside templates.

Targeted checks passed:

- `node scripts/test-rc4-user-centric-copy.cjs`
- `node scripts/test-learning-evidence-flow.cjs`
- `node scripts/test-rc3-teacher-blackboard.cjs`
- four viewModel tests
- companion preference tests

Final verification:

- `npm.cmd test`: pending final run.
- `scripts/verify.ps1`: pending final run.

## 9. Remaining Risk

No current P0 is known before final verification.

Residual product risks:

- Legacy lower-page modules still exist and must remain isolated.
- Real-device screenshots are still needed for small-screen density, bottom Tab overlap, and top capsule spacing.
- AppID remains `touristappid`, so upload is still blocked until real AppID configuration.
