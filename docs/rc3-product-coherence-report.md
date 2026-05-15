# RC3 Product Coherence Report

Date: 2026-05-13

## 1. Scope

This round was a pre-real-device product coherence pass. It did not add a product feature, Tab, backend API, Qwen API integration, OCR, PDF/PPT import, answer generation, teacher, dashboard, ranking, PK, or large UI refactor.

Goal sentence:

孩子选择一位老师，老师陪他把今晚学习路线走完；遇到卡点时，不直接给答案，而是用小黑板帮他看清第一步，最后生成回访卡和家长只问一句。

## 2. Home Teacher Area

Result: lightweight.

Home still uses a 2x3 teacher selector after the main CTA/input card area. It keeps:

- 小原 | 帮我理顺一点
- 问问 | 多问我一步
- 安安 | 慢一点陪我
- 阿衡 | 记得我以前的卡点
- 团团 | 帮我讲给家长听
- 跃跃 | 陪我闯一小关

The selector is a companionship choice, not a functional entry.

It does not use:

- 作业规划老师
- 错题老师
- 复习老师
- 家长老师
- 数学老师
- 英语老师

Main CTA priority remains:

- `帮我安排今晚学习` is still the Home primary CTA.
- The teacher selector stays after the main action and does not replace the route-start question.

## 3. Blackboard Coherence

Result: still a first-step hint layer.

原点小黑板:

- Appears only when there is todayFocus and repair has started.
- Supports only 列式关系 / 读题审题 / 步骤断点 / 概念公式.
- Does not appear for unsupported issueType.
- Outputs a title, a short prompt, and a structure.
- Does not generate a final answer.
- Does not output full solution steps.

Templates remain:

- 列式关系: 关系小黑板 / 整体 -> 部分 -> 关系
- 读题审题: 审题小黑板 / 问题 -> 条件 -> 第一步
- 步骤断点: 步骤小黑板 / 第一步 -> 下一步 -> 检查
- 概念公式: 概念小黑板 / 概念 -> 条件 -> 公式

Evidence flow remains:

- `blackboardHint` / `blackboardUsedAt` can be saved locally.
- `reviewCard` can reference blackboardHint.
- `profileViewModel` can show a one-line blackboard evidence section.

## 4. Not A Qwen Wrapper

RC3.3 explicitly avoids becoming a 千问 wrapper:

- No 千问主路径.
- No 千问跳转.
- No 千问界面嵌入.
- No 拍题讲解.
- No 拍照出答案.
- No complete answer generation.

Qwen/千问 is treated only as future capability inspiration for board-style first-step hints. If used later, it should be a bottom-layer capability for 原点小黑板, not the product shell.

## 5. Competitor Absorption

Khanmigo:

- Absorbed: do not directly answer; guide the child to think.
- Current evidence: tutor ladder, miniActionText, answer-request blocking.
- Not yet: high-quality subject understanding or system-level safety evaluation.

Gizmo:

- Absorbed: reviewCard, active recall, lightweight review.
- Current evidence: completed focus creates reviewCard; Tools is centered on one recall step.
- Not yet: mature spaced repetition, multi-format import, full deck system.

Nova:

- Absorbed: role continuity, companionship, memory feel.
- Current evidence: selectedCompanion follows the whole route.
- Boundary: teachers are companionship styles, not functional divisions.

Qwen / 千问:

- Absorbed: board-style visual hint inspiration.
- Current evidence: 原点小黑板.
- Boundary: no wrapper, no jump, no embedded interface, no full answer.

## 6. Yuandian Differentiation

原点自己的差异化闭环:

学校作业 -> 个性化晚间路线 -> 说第一步 -> 小黑板提示第一步 -> 修卡点 -> 生成回访卡 -> 家长只问一句。

千问强在“把题讲清楚”。

原点强在“今晚怎么学完、卡点怎么修、明天怎么回访、家长怎么问”。

## 7. Four Tab Coherence

Home:

- Only answers: 今晚从哪一步开始？
- Main CTA: 帮我安排今晚学习.

Review:

- Only answers: 今晚只修一个卡点.
- Core: todayFocus + miniActionText + 小黑板提示.

Tools:

- Only answers: 今天回访一小步.
- Core: reviewCard.

Profile:

- Only answers: 今晚家长只问这一句.
- Core: 孩子说出的第一步 + 小黑板提示 + 家长只问一句.

## 8. Residual Risk

No current P0 was found in product coherence.

Remaining P1/P2 risks:

- Legacy panels still exist below first screen and should stay isolated in future rounds.
- Real-device screenshots are still needed for small-screen density, capsule collision, and bottom Tab overlap.
- AppID is still `touristappid`, so upload/experience-version flow remains blocked until real AppID configuration.

## 9. Tests

Added:

- `scripts/test-rc3-product-coherence.cjs`

It checks:

- Home teacher selector stays lightweight.
- Main CTA remains primary.
- Teacher copy remains companionship style.
- Blackboard appears only in repair state.
- Unsupported issueType does not force blackboard.
- Blackboard avoids answer-tool and full-solution wording.
- Profile can read miniActionText and blackboardHint.
- First-screen product copy avoids 千问主路径, teacher division, internal-risk, and answer-tool wording.

Verification:

- Targeted RC3 product coherence test: passed.
- RC3 teacher blackboard test: passed.
- Four viewModel tests: passed.
- Full `npm.cmd test`: pending final verification.
- `scripts/verify.ps1`: pending final verification.

## 10. Recommendation

After final verification passes, the next step should be:

- Configure real AppID.
- Configure request合法域名: `https://yuandianzhixue.com`.
- Enter real-device screenshot acceptance.
