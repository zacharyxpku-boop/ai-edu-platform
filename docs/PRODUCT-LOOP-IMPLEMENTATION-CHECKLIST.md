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
