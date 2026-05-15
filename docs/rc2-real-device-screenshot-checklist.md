# RC2 Real Device Screenshot Checklist

## Before Screenshots

- Confirm AppID is real, not `touristappid`.
- Confirm WeChat request legal domain includes `https://yuandianzhixue.com`.
- Clear local learning state before the full path test.
- Capture on at least one small iPhone/Android viewport and one normal-size phone.

## 1. Home Default

Check:
- First glance shows "Tonight starts from which step?" / "今晚从哪一步开始？".
- Main CTA "帮我安排今晚学习" is visually strongest.
- `routePill` feels light and compact.
- `companionStrip` feels light and does not look like a second title.
- `teacherPickerHint` does not compete with the main CTA.
- Input card is clear.
- Bottom Tab does not cover the main CTA.
- Top content does not collide with the WeChat capsule.

## 2. Home Teacher Picker Expanded

Check:
- No six-grid of teachers is directly spread across the first screen.
- It is not a set of large role cards.
- It explains companion style, not functional teacher division.
- It does not cover the main CTA.
- It does not show "6 位老师怎么分工".

## 3. Review Default / No todayFocus

Check:
- First glance shows "今晚只修一个卡点".
- Empty state has only one main action: "去说第一步".
- No error-type dashboard.
- No "当前演示判断".

## 4. Review In Progress

Check:
- `miniActionText` input area is clear.
- Trying to complete without `miniActionText` cannot mark repair completed.
- Main CTA is clear.
- There are not multiple primary actions competing visually.

## 5. Tools Without reviewCard

Check:
- First glance shows "今天回访一小步".
- Empty state main CTA is "开始试玩".
- Four play modes do not steal the first-screen main task.
- No backend taxonomy feeling such as "今天补哪块记忆 / 提取记忆 / 概念边界".

## 6. Tools With reviewCard

Check:
- A concrete recall card is shown.
- Card references `todayFocus` or `miniActionText`.
- Main CTA is "开始回访".

## 7. Profile Default

Check:
- First glance shows "今晚家长只问这一句".
- Main card only contains:
  - 今天卡在哪
  - 孩子说出的第一步
  - 家长只问一句
  - 明天怎么回访
- No report wall.
- No dashboard.
- No commercial unlock entry.
- No "系统诊断 / 家长应监督 / 严重薄弱 / 孩子问题".

## 8. Four Tabs After Selecting An An

Check:
- Four `companionStrip` lines are all An An voice.
- Tone is low-pressure.
- Learning rules do not change.

## 9. Four Tabs After Selecting Wen Wen

Check:
- Four `companionStrip` lines are all Wen Wen voice.
- Tone emphasizes the first step.
- It does not directly give answers.

## 10. Tools / Profile After Selecting Yue Yue

Check:
- There is a light challenge feeling.
- No leaderboard / PK / ranking language.
- Profile is still child-friendly parent recap, not a game battle report.

## RC2 Required Full Path

1. Clear local learning state.
2. Open Home.
3. Tap "今天想让谁陪你？".
4. Select "安安｜慢一点陪我".
5. Enter:

```text
数学应用题 8 道，明天交；英语单词 20 个，明天测；语文阅读 1 篇，后天交；今晚 60 分钟。
```

6. Tap "帮我安排今晚学习".
7. Enter:

```text
我写到第二步就乱了。
```

8. Confirm `todayFocus`:
   - `issueType = 步骤断点`
   - `title` contains "第二步"
   - `sourceText` preserves the original sentence
9. Enter Review.
10. Tap "开始 5 分钟修复".
11. Try to complete without `miniActionText`; confirm it cannot become `completed`.
12. Enter:

```text
我先找题目问什么。
```

13. Complete repair.
14. Confirm `miniActionText` is saved.
15. Enter Tools.
16. Confirm `reviewCard` references the concrete stuck point or `miniActionText`.
17. Enter Profile.
18. Confirm "孩子说出的第一步" appears.
19. Confirm "家长只问一句" is based on `miniActionText`.
20. Enter "直接告诉我答案"; confirm it is still blocked by the tutor ladder.

## Storage Fields To Inspect

In WeChat DevTools Storage panel, inspect:
- `companionPreference`
- `todayFocus`
- `reviewCard`
- `reviewEvents`
- `tonightPlan`

Key fields:
- `sourceText`
- `issueType`
- `title`
- `miniActionText`
- `miniActionAt`
- `repairStatus`
- `completed_at`
- `reviewCard.front`
- `reviewCard.backPrompt`
