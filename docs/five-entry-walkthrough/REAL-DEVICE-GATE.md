# Real Device Gate

Generated: 2026-05-30T13:42:42.608Z

Status: BLOCKED

## Checks

- WeChat DevTools CLI: C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat
- Service port 9420: closed
- Project path: C:\Users\86136\Desktop\claude\ai-edu-platform\miniprogram
- Latest miniapp source mtime: 2026-05-30T13:31:20.028Z

## Required Screenshots

- tab-today.png: invalid
  - route: /pages/home/home
  - action: Open Today tab directly
  - expected: Short entry screen only; no dense retired content below the first screen
  - size: 585x1266
  - captured: 2026-05-25T01:57:22.550Z
  - freshness: stale or missing
- tab-tutor.png: invalid
  - route: /pages/tutor/tutor
  - action: Open homework coaching tab directly
  - expected: Short tutor entry screen; primary CTA jumps to child/detail flow
  - size: 585x1266
  - captured: 2026-05-25T01:57:29.122Z
  - freshness: stale or missing
- tab-arcade.png: invalid
  - route: /pages/arcade/arcade
  - action: Open Review Island tab directly
  - expected: Short review/game entry screen; no dense mission list by default
  - size: 585x1266
  - captured: 2026-05-25T01:57:36.885Z
  - freshness: stale or missing
- tab-parent.png: invalid
  - route: /pages/profile/profile
  - action: Open Parent tab directly
  - expected: Parent sees key progress entry screen, not a report wall
  - size: 585x1266
  - captured: 2026-05-25T01:57:51.596Z
  - freshness: stale or missing
- tab-upload.png: invalid
  - route: /pages/upload/upload
  - action: Open Upload tab directly
  - expected: Upload entry screen focuses on material intake and learning pack
  - size: 585x1266
  - captured: 2026-05-25T01:57:59.846Z
  - freshness: stale or missing
- child-today-first-step.png: invalid
  - route: /pages/entry-detail/entry-detail?scene=today
  - action: Today primary CTA -> entry detail -> primary action
  - expected: Returns to tutor with open=flow and visible first-step function area
  - size: 585x1266
  - captured: 2026-05-25T01:58:08.165Z
  - freshness: stale or missing
- child-tutor-flow.png: invalid
  - route: /pages/entry-detail/entry-detail?scene=tutor
  - action: Tutor primary CTA -> entry detail -> primary action
  - expected: Returns to tutor with open=flow and visible conversation composer
  - size: 585x1266
  - captured: 2026-05-25T01:58:16.503Z
  - freshness: stale or missing
- child-review-recall.png: invalid
  - route: /pages/entry-detail/entry-detail?scene=review
  - action: Review primary CTA -> entry detail -> primary action
  - expected: Opens recall/review child flow for memory and transfer validation
  - size: 585x1266
  - captured: 2026-05-25T01:58:26.227Z
  - freshness: stale or missing
- child-parent-report.png: invalid
  - route: /pages/entry-detail/entry-detail?scene=parent
  - action: Parent primary CTA -> entry detail -> primary action
  - expected: Returns to parent with open=flow and visible evidence/report function area
  - size: 585x1266
  - captured: 2026-05-25T01:58:39.996Z
  - freshness: stale or missing
- child-upload-material.png: invalid
  - route: /pages/entry-detail/entry-detail?scene=upload
  - action: Upload primary CTA -> entry detail -> primary action
  - expected: Returns to upload with open=flow and visible material intake function area
  - size: 585x1266
  - captured: 2026-05-25T01:58:51.427Z
  - freshness: stale or missing
- entry-detail-today.png: missing
  - route: /pages/entry-detail/entry-detail?scene=today
  - action: Open Today child detail page before tapping primary action
  - expected: Graphical child page with brand mark, scene hero, three-step path, numbered evidence cards, and cross-entry jump cards
  - size: n/a
  - captured: n/a
  - freshness: stale or missing
- entry-detail-tutor.png: missing
  - route: /pages/entry-detail/entry-detail?scene=tutor
  - action: Open Tutor child detail page before tapping primary action
  - expected: Graphical AI tutor child page with visual hero and clear next-action buttons
  - size: n/a
  - captured: n/a
  - freshness: stale or missing
- entry-detail-review.png: missing
  - route: /pages/entry-detail/entry-detail?scene=review
  - action: Open Review child detail page before tapping primary action
  - expected: Graphical review child page with memory/transfer explanation and cross-entry jump cards
  - size: n/a
  - captured: n/a
  - freshness: stale or missing
- entry-detail-parent.png: missing
  - route: /pages/entry-detail/entry-detail?scene=parent
  - action: Open Parent child detail page before tapping primary action
  - expected: Graphical parent child page focused on evidence, method reasoning, and next action
  - size: n/a
  - captured: n/a
  - freshness: stale or missing
- entry-detail-upload.png: missing
  - route: /pages/entry-detail/entry-detail?scene=upload
  - action: Open Upload child detail page before tapping primary action
  - expected: Graphical upload child page focused on material classification and stable SOP
  - size: n/a
  - captured: n/a
  - freshness: stale or missing

## Rule

Static HTML previews and desktop screenshots do not satisfy this gate. This file only passes when WeChat DevTools service port is reachable and all required simulator/phone screenshots are present and newer than the current miniapp source files.

## Unblock Steps

1. Open WeChat DevTools.
2. Settings -> Security Settings -> enable service port.
3. Confirm 127.0.0.1:9420 is reachable.
4. Capture the listed simulator/phone screenshots under `docs/five-entry-walkthrough/real-device/` with the exact file names above.
5. Run `npm run miniapp:real-device-gate` again.
